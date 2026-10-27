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

Since the Traveling Salesperson Problem is **NP-hard**, computing the exact global optimum becomes computationally intractable as $|C|$ grows. The engine therefore decomposes the problem into a two-phase architecture:
1. **Shortest Path Road Metric Generation:** Exact all-pairs shortest paths via Dijkstra's algorithm.
2. **Tour Construction & Improvement:** Greedy heuristic construction (Nearest Neighbor) followed by local search optimization (2-Opt).

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
Along with distance $D[i][j]$, the matrix caches the reconstructed road node sequence `roadPath[i][j]`.

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
If $\Delta < -\epsilon$, the reversal yields a strictly shorter tour. The algorithm applies the reversal and continues scanning until no improving 2-opt move exists (**local optimum**).

#### Theoretical Limitation (Local Optimum vs. Global Optimum):
> **Important:** 2-Opt is a **local search heuristic**. It explores the 2-exchange neighborhood of the current tour. When no 2-exchange can reduce the cost, 2-Opt terminates at a **2-optimal local minimum**. It **does not guarantee the global optimum**, as it cannot escape local minima that require 3-opt, k-opt, or non-improving transitional moves to untangle.

---

## 4. Complexity Analysis

Let:
- $|V|$ = number of total road intersections in graph $G$
- $|E|$ = number of road segments in graph $G$
- $K = |C| + 1$ = number of stops in delivery problem ($K \ll |V|$)

| Phase | Algorithm | Time Complexity | Space Complexity | Notes |
|---|---|---|---|---|
| **Graph Construction** | Adjacency List | $O(\|V\| + \|E\|)$ | $O(\|V\| + \|E\|)$ | Efficient memory scaling for sparse road networks |
| **Shortest Paths** | Dijkstra (Min-Heap) | $O(K \cdot (\|V\| + \|E\|) \log \|V\|)$ | $O(\|V\| + \|E\|)$ | Run once from each stop $s \in \{w_0\} \cup C$ |
| **Distance Matrix** | All-Pairs Matrix | $O(K^2)$ | $O(K^2)$ | Caches distances and parent paths |
| **Tour Construction** | Nearest Neighbor | $O(K^2)$ | $O(K)$ | Greedy selection across unvisited stops |
| **Tour Improvement** | 2-Opt Local Search | $O(M \cdot K^2)$ | $O(K)$ | $M$ = number of improving iterations ($M \le 1000$) |
| **Path Expansion** | Road Node Sequencing | $O(L)$ | $O(L)$ | $L$ = total road nodes in complete tour ($L \le \|V\|$) |
| **Total Engine Pipeline** | Combined | $O(K (\|V\| + \|E\|)\log \|V\| + M K^2)$ | $O(\|V\| + \|E\| + K^2)$ | Execution typically under 1 ms for $K \le 20$ |

### Comparison: Brute-Force Exact Reference Solver (Test Harness)
In the test suite (`test_algorithms.cpp`), an exact reference solver computes all $(K-1)! / 2$ permutations:
- **Time Complexity:** $O((K-1)! \cdot K)$
- **Space Complexity:** $O(K)$
- **Practical Limit:** $K \le 10$. For $K = 5$, $(5-1)! = 24$ permutations (instantaneous). For $K = 20$, $(19)! \approx 1.21 \times 10^{17}$ operations (impossible in human lifetime). This illustrates why heuristic and local search approximations (NN + 2-Opt) are essential for real-world delivery routing.

---

## 5. Metrics & Validation Invariants

1. **Tour Closed Cycle:** $T[0] = w_0$ and $T[|T|-1] = w_0$.
2. **Every Stop Visited Exactly Once:** For all $c \in C$, $|\{i \mid T[i] = c\}| = 1$.
3. **Monotonic Improvement:**
   $$\text{Cost}(T_{\text{2-opt}}) \le \text{Cost}(T_{\text{NN}})$$
4. **Distance Saved:**
   $$\Delta_{\text{saved}} = \text{Cost}(T_{\text{NN}}) - \text{Cost}(T_{\text{2-opt}}) \ge 0$$
5. **Percentage Improvement:**
   $$P_{\text{imp}} = \begin{cases} \frac{\Delta_{\text{saved}}}{\text{Cost}(T_{\text{NN}})} \times 100\% & \text{if } \text{Cost}(T_{\text{NN}}) > 0 \\ 0\% & \text{otherwise} \end{cases}$$
6. **Road Edge Conformance:**
   For every consecutive customer leg $(u, v)$ in the tour, the expanded road intersection sequence $[p_0, p_1, \ldots, p_m]$ satisfies:
   $$p_0 = u, \quad p_m = v, \quad \forall i \in [0, m-1]: (p_i, p_{i+1}) \in E$$
