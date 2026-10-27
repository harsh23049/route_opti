# Algorithm Design & Theoretical Foundations

This document details the algorithm design, mathematical formulations, algorithmic paradigms, time/space complexities, and theoretical limitations for the **Smart Delivery Route Optimization** engine.

---

## 1. Problem Formulation

The problem is modeled as a **Vehicle Routing Problem on a Road Network** (also characterized as the Metric Traveling Salesperson Problem on an induced road metric):

Given:
1. An **undirected weighted road graph** $G = (V, E, w)$ where:
   - $V$ is the set of physical road intersections, landmarks, and addresses.
   - $E \subseteq V \times V$ is the set of bidirectional road segments.
   - $w: E \to \mathbb{R}^+$ defines the non-negative physical road travel distance (kilometers).
2. A designated **warehouse / depot** vertex $w_0 \in V$.
3. A subset of required **delivery customer stops** $C = \{c_1, c_2, \ldots, c_k\} \subseteq V \setminus \{w_0\}$.

**Objective:**
Find a closed tour starting at $w_0$, visiting each customer $c_i \in C$ at least once (or exactly once in the customer visit order), and returning to $w_0$, such that the total traversed road distance is minimized:
$$\min \sum_{i=0}^{k} \text{dist}_G(v_i, v_{i+1}) \quad \text{where } v_0 = v_{k+1} = w_0, \{v_1, \ldots, v_k\} = C$$

Since the Traveling Salesperson Problem is **NP-hard**, computing the exact global optimum becomes computationally intractable as $|C|$ grows. The engine therefore decomposes the problem into three phases:
1. **Shortest Path Road Metric Generation:** Exact all-pairs shortest paths via Dijkstra's algorithm.
2. **Tour Construction & Improvement:** Greedy heuristic construction (Nearest Neighbor), then local search (2-Opt, followed by alternating Or-opt / 2-Opt until neither improves).
3. **Exact Ground Truth (small instances):** Held-Karp dynamic programming computes the true optimum when $|C| \le 15$, so every response can report how far the heuristic tour is from optimal.

---

## 2. Core Assumptions

1. **Undirected Road Graph:** All street segments are bidirectional with identical distance in both directions ($w(u, v) = w(v, u)$).
2. **Non-Negative Weights:** Road lengths are non-negative ($w(e) \ge 0$), satisfying Dijkstra's prerequisites.
3. **Induced Metric Space:** The shortest-path distance function $\text{dist}_G(u, v)$ satisfies:
   - Non-negativity: $\text{dist}_G(u, v) \ge 0$
   - Identity of indiscernibles: $\text{dist}_G(u, v) = 0 \iff u = v$
   - Symmetry: $\text{dist}_G(u, v) = \text{dist}_G(v, u)$
   - Triangle inequality: $\text{dist}_G(u, v) \le \text{dist}_G(u, z) + \text{dist}_G(z, v) \quad \forall u, v, z \in V$
4. **Single Vehicle Delivery:** A single delivery vehicle departs from $w_0$ with sufficient capacity to fulfill all stops in $C$ in one trip.

---

## 3. Algorithmic Modules

### 3.1. Dijkstra's Algorithm (Shortest Paths & Reconstruction)

For each key location $s \in \{w_0\} \cup C$, Dijkstra's algorithm computes the shortest road distance and the exact sequence of road intersections to every other reachable vertex in $V$.

- **Data Structure:** Adjacency list representation of $G$ with a binary min-priority queue storing pairs $(d, u)$.
- **Predecessor Tracking:** Maintains `parent[v]` pointers allowing backtracking the exact shortest path:
  $$\text{Path}(s, t) = [s, \ldots, \text{parent}[\text{parent}[t]], \text{parent}[t], t]$$
- **Unreachability Handling:** If $t$ remains with distance $\infty$, the system detects graph disconnection and raises a structured error before tour generation.

### 3.2. All-Pairs Distance Matrix ($K \times K$)

Let $K = |C| + 1$ denote the number of points of interest (warehouse + customers). We construct a symmetric distance matrix $D \in \mathbb{R}^{K \times K}$:
$$D[i][j] = \text{dist}_G(v_i, v_j)$$
Alongside $D$, the matrix keeps each source's Dijkstra predecessor array (`parents[i]`, length $|V|$). The road node sequence for a leg $i \to j$ is rebuilt on demand by walking `parents[i]` back from $v_j$. This keeps memory at $O(K \cdot |V|)$ instead of $O(K^2 \cdot L)$ for caching every full path.

- **Symmetry Verification:** Because $G$ is undirected, $D[i][j] = D[j][i]$. The implementation verifies this invariance with precision $\epsilon = 10^{-6}$.

### 3.3. Phase 1: Nearest Neighbor Heuristic (Greedy Tour Construction)

The Nearest Neighbor (NN) algorithm constructs an initial closed TSP tour $T_{\text{init}}$:
1. Start at the warehouse: $v_0 = w_0$, set of unvisited stops $U = C$.
2. While $U \ne \emptyset$:
   - Select $u^* = \arg\min_{u \in U} D[v_{\text{current}}][u]$.
   - Append $u^*$ to the tour.
   - Remove $u^*$ from $U$ and update $v_{\text{current}} \leftarrow u^*$.
3. Return to the warehouse: Append $w_0$ to close the cycle.

#### Theoretical Limitation (Greedy Nature):
> **Important:** Nearest Neighbor is a **greedy heuristic**. At each step, it makes the locally optimal choice without considering the global topology. It can be forced into taking high-cost edges near the end of the tour ("greedy trap"). Consequently, Nearest Neighbor **does not guarantee the global optimum**.

### 3.4. Phase 2: 2-Opt Local Search (Tour Improvement)

The 2-Opt algorithm systematically evaluates whether replacing two non-adjacent edges in the tour with two new edges reduces the total tour length:

Given tour $T = [v_0, v_1, \ldots, v_i, v_{i+1}, \ldots, v_j, v_{j+1}, \ldots, v_n]$ where $v_0 = v_n = w_0$:
- Replace edges $(v_i, v_{i+1})$ and $(v_j, v_{j+1})$ with $(v_i, v_j)$ and $(v_{i+1}, v_{j+1})$.
- This corresponds to reversing the intermediate sub-tour: $[v_{i+1}, \ldots, v_j]$.
- **Depot Invariance:** Indices $i$ and $j$ satisfy $0 \le i < j - 1 < n$. The warehouse endpoints ($v_0$ and $v_n$) remain strictly fixed at index $0$ and $n$.

#### $O(1)$ Delta Evaluation:
Because $D$ is symmetric, reversing the segment $[v_{i+1}, \dots, v_j]$ preserves the internal sum of edge costs. The change in tour length $\Delta$ is calculated in $O(1)$ time:
$$\Delta = (D[v_i][v_j] + D[v_{i+1}][v_{j+1}]) - (D[v_i][v_{i+1}] + D[v_j][v_{j+1}])$$
If $\Delta < -\epsilon$ (with $\epsilon = 10^{-9}$), the reversal yields a strictly shorter tour. The algorithm applies the reversal in place and **keeps scanning the same pass** (it does not restart from $i = 1$). Passes repeat until a full pass finds no improving move, which is a 2-opt **local optimum**. A safety cap of 1000 passes is never reached on realistic inputs.

#### Theoretical Limitation (Local Optimum vs. Global Optimum):
> **Important:** 2-Opt is a **local search heuristic**. It explores the 2-exchange neighborhood of the current tour. When no 2-exchange can reduce the cost, 2-Opt terminates at a **2-optimal local minimum**. It **does not guarantee the global optimum**, as it cannot escape local minima that require 3-opt, k-opt, or non-improving transitional moves to untangle.

### 3.5. Phase 3: Or-opt Local Search (Segment Relocation)

Or-opt removes a segment of 1, 2 or 3 consecutive customer stops and reinserts it between two other consecutive stops, in either orientation. 2-Opt fixes crossings. Or-opt fixes a stop that sits on the wrong part of an otherwise good tour, a move 2-Opt can only make through several reversals.

For segment $[v_i, \ldots, v_j]$ and insertion edge $(a, b)$:
$$\text{gain}_{\text{remove}} = D[v_{i-1}][v_i] + D[v_j][v_{j+1}] - D[v_{i-1}][v_{j+1}]$$
$$\text{cost}_{\text{insert}} = \min\big(D[a][v_i] + D[v_j][b],\; D[a][v_j] + D[v_i][b]\big) - D[a][b]$$
The move is applied when $\text{cost}_{\text{insert}} - \text{gain}_{\text{remove}} < -\epsilon$. Both terms are $O(1)$, so one scan costs $O(K^2)$.

The pipeline alternates the two operators: an Or-opt move can expose new 2-Opt moves and vice versa. It stops when Or-opt finds nothing, or when the 2-Opt sweep that follows changes nothing. The final tour is therefore locally optimal for **both** neighborhoods (this is asserted in the tests).

### 3.6. Exact Reference: Held-Karp Dynamic Programming

For $n = |C| \le 15$ customers the engine also computes the exact optimum:
$$dp[S][j] = \min_{k \in S \setminus \{j\}} \big(dp[S \setminus \{j\}][k] + D[k][j]\big), \qquad dp[\{j\}][j] = D[w_0][j]$$
$$\text{OPT} = \min_{j} \big(dp[C][j] + D[j][w_0]\big)$$
Parent pointers rebuild the optimal visiting order. With $n = 15$ this is about $7.4 \times 10^6$ transitions and roughly 6 MB, a few milliseconds. Above the limit the exact fields in the response are `null`. Every response reports the **optimality gap** $(\text{Cost}(T_{\text{heuristic}}) - \text{OPT}) / \text{OPT} \times 100\%$.

---

### 3.7. Multi-Van Split: Route First, Cluster Second
With $V$ vans the goal is to finish all deliveries soonest: minimize the **longest** van route. (Total distance alone always prefers one van, because splitting a tour never makes it shorter under the triangle inequality.)

1. **Giant tour:** take the best single-van tour (Held-Karp's when available, else the 2-Opt + Or-opt tour) and the Nearest Neighbor tour as candidates.
2. **Split (Beasley 1983; Prins 2004, min-max form):** for a giant tour $s_1, \dots, s_n$, let $c(i, j)$ be the trip depot $\to s_i \to \dots \to s_j \to$ depot. Then
   $f_t(j) = \min_{i < j} \max\big(f_{t-1}(i),\ c(i+1, j)\big)$ with $f_0(0) = 0$, ties broken toward a smaller total. The best $f_t(n)$ over $t \le V$ is the optimal cut of that stop order. Prefix sums make each $c(i, j)$ an $O(1)$ lookup, so the split is $O(V n^2)$.
3. **Re-optimize** every trip with 2-Opt and Or-opt.
4. **Balance (inter-route relocate):** move one stop off the longest trip to the cheapest position in another trip whenever both end up shorter than the old longest trip; re-optimize both and repeat. Each move strictly lowers the longest trip or the number of trips at that length, so it terminates.

Because the Nearest Neighbor tour is a candidate and its equal-parts cut is one of the cuts the DP considers, the plan is never worse than the baseline. The split is exact only for the given stop order and the balancing is a local search, so the plan is a heuristic, not a proven optimum.

## 4. Complexity Analysis

Let:
- $|V|$ = number of total road intersections in graph $G$
- $|E|$ = number of road segments in graph $G$
- $K = |C| + 1$ = number of stops in delivery problem ($K \ll |V|$)

| Phase | Algorithm | Time Complexity | Space Complexity | Notes |
|---|---|---|---|---|
| **Graph Construction** | Adjacency List | $O(\|V\| + \|E\|)$ | $O(\|V\| + \|E\|)$ | Efficient memory scaling for sparse road networks |
| **Shortest Paths** | Dijkstra (Min-Heap) | $O(K \cdot (\|V\| + \|E\|) \log \|V\|)$ | $O(\|V\| + \|E\|)$ | Run once from each stop $s \in \{w_0\} \cup C$ |
| **Distance Matrix** | All-Pairs Matrix | $O(K^2)$ | $O(K^2 + K \cdot \|V\|)$ | Distances plus one predecessor array per stop |
| **Tour Construction** | Nearest Neighbor | $O(K^2)$ | $O(K)$ | Greedy selection across unvisited stops |
| **Tour Improvement** | 2-Opt Local Search | $O(P \cdot K^2)$ | $O(K)$ | $P$ = number of passes until no improving move |
| **Tour Improvement** | Or-opt (alternating with 2-Opt) | $O(M \cdot K^2)$ | $O(K)$ | $M$ = number of applied moves; rescans after each move |
| **Exact Reference** | Held-Karp DP | $O(2^n \cdot n^2)$ | $O(2^n \cdot n)$ | Only when $n = K - 1 \le 15$ |
| **Path Expansion** | Road Node Sequencing | $O(L)$ | $O(L)$ | $L$ = total road nodes in complete tour |
| **Total Engine Pipeline** | Combined | $O(K (\|V\| + \|E\|)\log \|V\| + (P + M) K^2)$ | $O(\|V\| + \|E\| + K \cdot \|V\|)$ | See the benchmark table in the README |

### Comparison: Brute-Force Exact Reference Solver (Test Harness)
In the test suite (`test_algorithms.cpp`), an exact reference solver enumerates all $(K-1)!$ customer permutations. It is used to verify Held-Karp on instances with up to 8 customers:
- **Time Complexity:** $O((K-1)! \cdot K)$
- **Space Complexity:** $O(K)$
- **Practical Limit:** $K \le 10$. For $K = 5$, $(5-1)! = 24$ permutations (instantaneous). For $K = 20$, $(19)! \approx 1.21 \times 10^{17}$ operations (impossible in human lifetime). This illustrates why heuristic and local search approximations (NN + 2-Opt) are essential for real-world delivery routing.

---

## 5. Metrics & Validation Invariants

1. **Tour Closed Cycle:** $T[0] = w_0$ and $T[|T|-1] = w_0$.
2. **Every Stop Visited Exactly Once:** For all $c \in C$, $|\{i \mid T[i] = c\}| = 1$.
3. **Monotonic Improvement and Optimality Bound:**
   $$\text{OPT} \le \text{Cost}(T_{\text{final}}) \le \text{Cost}(T_{\text{2-opt}}) \le \text{Cost}(T_{\text{NN}})$$
4. **Distance Saved:**
   $$\Delta_{\text{saved}} = \text{Cost}(T_{\text{NN}}) - \text{Cost}(T_{\text{2-opt}}) \ge 0$$
5. **Percentage Improvement:**
   $$P_{\text{imp}} = \begin{cases} \frac{\Delta_{\text{saved}}}{\text{Cost}(T_{\text{NN}})} \times 100\% & \text{if } \text{Cost}(T_{\text{NN}}) > 0 \\ 0\% & \text{otherwise} \end{cases}$$
6. **Road Edge Conformance:**
   For every consecutive customer leg $(u, v)$ in the tour, the expanded road intersection sequence $[p_0, p_1, \ldots, p_m]$ satisfies:
   $$p_0 = u, \quad p_m = v, \quad \forall i \in [0, m-1]: (p_i, p_{i+1}) \in E$$
