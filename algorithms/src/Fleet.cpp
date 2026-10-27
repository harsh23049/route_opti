#include "Fleet.h"
#include "TwoOpt.h"
#include "OrOpt.h"
#include <algorithm>
#include <cstddef>
#include <limits>

namespace DeliveryOptimizer {

namespace {
constexpr double kEpsilon = 1e-9;
constexpr int kMaxLocalSearchRounds = 100;
constexpr int kMaxBalanceMoves = 1000;

struct SplitCost {
    double longest;
    double total;
};

bool better(const SplitCost& a, const SplitCost& b) {
    if (a.longest < b.longest - kEpsilon) return true;
    if (a.longest > b.longest + kEpsilon) return false;
    return a.total < b.total - kEpsilon;
}

FleetPlan summarize(std::vector<VehicleRoute> routes) {
    FleetPlan plan;
    for (const auto& r : routes) {
        plan.totalDistanceKm += r.distanceKm;
        plan.longestRouteKm = std::max(plan.longestRouteKm, r.distanceKm);
    }
    plan.routes = std::move(routes);
    return plan;
}

void polish(VehicleRoute& route, const DistanceMatrix& matrix) {
    TwoOpt::improve(route.tour, matrix);
    for (int round = 0; round < kMaxLocalSearchRounds; ++round) {
        if (OrOpt::improve(route.tour, matrix) == 0 || TwoOpt::improve(route.tour, matrix) == 0) break;
    }
    route.distanceKm = TwoOpt::computeTourDistance(route.tour, matrix);
}

VehicleRoute makeRoute(std::vector<int>::const_iterator first, std::vector<int>::const_iterator last,
                       const DistanceMatrix& matrix, bool optimize) {
    VehicleRoute route;
    route.tour.push_back(0);
    route.tour.insert(route.tour.end(), first, last);
    route.tour.push_back(0);
    if (optimize) polish(route, matrix);
    else route.distanceKm = TwoOpt::computeTourDistance(route.tour, matrix);
    return route;
}

// Inter-route relocate: moves one stop off the longest route to the cheapest spot on another
// route whenever both routes end up shorter than the old longest. The split only sees cuts of
// one stop order; this lets stops cross between neighbouring trips.
void balance(std::vector<VehicleRoute>& routes, const DistanceMatrix& matrix) {
    auto d = [&](int a, int b) { return matrix.getDistance(a, b); };
    for (int move = 0; move < kMaxBalanceMoves && routes.size() > 1; ++move) {
        size_t from = 0;
        for (size_t r = 1; r < routes.size(); ++r) {
            if (routes[r].distanceKm > routes[from].distanceKm) from = r;
        }
        const std::vector<int>& src = routes[from].tour;

        double bestWorst = routes[from].distanceKm - kEpsilon;
        size_t bestStop = 0, bestRoute = 0, bestPos = 0;
        for (size_t i = 1; i + 1 < src.size(); ++i) {
            const double shortened = routes[from].distanceKm - d(src[i - 1], src[i]) - d(src[i], src[i + 1])
                                   + d(src[i - 1], src[i + 1]);
            for (size_t r = 0; r < routes.size(); ++r) {
                if (r == from) continue;
                const std::vector<int>& dst = routes[r].tour;
                for (size_t p = 0; p + 1 < dst.size(); ++p) {
                    const double grown = routes[r].distanceKm + d(dst[p], src[i]) + d(src[i], dst[p + 1])
                                       - d(dst[p], dst[p + 1]);
                    const double worst = std::max(shortened, grown);
                    if (worst < bestWorst) {
                        bestWorst = worst;
                        bestStop = i;
                        bestRoute = r;
                        bestPos = p;
                    }
                }
            }
        }
        if (bestStop == 0) break;

        const int stop = routes[from].tour[bestStop];
        routes[from].tour.erase(routes[from].tour.begin() + static_cast<std::ptrdiff_t>(bestStop));
        routes[bestRoute].tour.insert(routes[bestRoute].tour.begin() + static_cast<std::ptrdiff_t>(bestPos) + 1, stop);
        polish(routes[from], matrix);
        polish(routes[bestRoute], matrix);
        if (routes[from].tour.size() <= 2) routes.erase(routes.begin() + static_cast<std::ptrdiff_t>(from));
    }
}

FleetPlan splitTour(const std::vector<int>& giantTour, const DistanceMatrix& matrix, int vehicles) {
    // Customer stops in tour order, without the warehouse at both ends.
    const std::vector<int> s(giantTour.begin() + 1, giantTour.end() - 1);
    const int n = static_cast<int>(s.size());
    if (n == 0) return {};
    const int k = std::clamp(vehicles, 1, n);

    // prefix[i] = road distance s[0] -> s[1] -> ... -> s[i] along the giant tour.
    std::vector<double> prefix(n, 0.0);
    for (int i = 1; i < n; ++i) prefix[i] = prefix[i - 1] + matrix.getDistance(s[i - 1], s[i]);
    auto trip = [&](int i, int j) {  // depot -> s[i..j] -> depot
        return matrix.getDistance(0, s[i]) + prefix[j] - prefix[i] + matrix.getDistance(s[j], 0);
    };

    // best[t][j]: cheapest way to serve the first j stops with t trips; cut[t][j]: where the last trip starts.
    const double inf = std::numeric_limits<double>::infinity();
    std::vector<std::vector<SplitCost>> best(k + 1, std::vector<SplitCost>(n + 1, {inf, inf}));
    std::vector<std::vector<int>> cut(k + 1, std::vector<int>(n + 1, -1));
    best[0][0] = {0.0, 0.0};
    for (int t = 1; t <= k; ++t) {
        for (int j = t; j <= n; ++j) {
            for (int i = t - 1; i < j; ++i) {
                if (best[t - 1][i].longest == inf) continue;
                const double c = trip(i, j - 1);
                const SplitCost cand{std::max(best[t - 1][i].longest, c), best[t - 1][i].total + c};
                if (better(cand, best[t][j])) {
                    best[t][j] = cand;
                    cut[t][j] = i;
                }
            }
        }
    }

    // Fewer vans can tie on the longest trip; prefer the plan with the shorter total.
    int trips = 1;
    for (int t = 2; t <= k; ++t) {
        if (better(best[t][n], best[trips][n])) trips = t;
    }

    std::vector<VehicleRoute> routes;
    for (int t = trips, j = n; t > 0; --t) {
        const int i = cut[t][j];
        routes.push_back(makeRoute(s.begin() + i, s.begin() + j, matrix, true));
        j = i;
    }
    std::reverse(routes.begin(), routes.end());
    balance(routes, matrix);
    return summarize(std::move(routes));
}

} // namespace

FleetPlan Fleet::plan(const std::vector<std::vector<int>>& giantTours, const DistanceMatrix& matrix, int vehicles) {
    FleetPlan best;
    bool have = false;
    for (const auto& tour : giantTours) {
        FleetPlan candidate = splitTour(tour, matrix, vehicles);
        if (!have || better({candidate.longestRouteKm, candidate.totalDistanceKm},
                            {best.longestRouteKm, best.totalDistanceKm})) {
            best = std::move(candidate);
            have = true;
        }
    }
    return best;
}

FleetPlan Fleet::chunk(const std::vector<int>& giantTour, const DistanceMatrix& matrix, int vehicles) {
    const std::vector<int> s(giantTour.begin() + 1, giantTour.end() - 1);
    const int n = static_cast<int>(s.size());
    if (n == 0) return {};
    const int k = std::clamp(vehicles, 1, n);

    std::vector<VehicleRoute> routes;
    for (int t = 0, start = 0; t < k; ++t) {
        const int size = n / k + (t < n % k ? 1 : 0);
        routes.push_back(makeRoute(s.begin() + start, s.begin() + start + size, matrix, false));
        start += size;
    }
    return summarize(std::move(routes));
}

} // namespace DeliveryOptimizer
