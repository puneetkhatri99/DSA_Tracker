# Cheat Sheet: Algorithms & Collections

> **Level:** Medium · **Part 6 of 8** in Time & Space Complexity
>
> **TL;DR**: the time and space of every standard algorithm and data structure, in one place. V = vertices, E = edges, L = string length, h = tree height, k = range of values, α = inverse Ackermann (≤ 4 in practice).

---

## Sorting

| Algorithm | Best | Average | Worst | Extra space | Stable |
|---|---|---|---|---|---|
| Bubble sort | O(n) (with early exit) | O(n²) | O(n²) | O(1) | yes |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | no |
| Insertion sort | O(n) (already sorted) | O(n²) | O(n²) | O(1) | yes |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | yes |
| Quicksort | O(n log n) | O(n log n) | O(n²) | O(log n) stack | no |
| Heapsort | O(n log n) | O(n log n) | O(n log n) | O(1) | no |
| Counting sort (values 0 … k) | O(n + k) | O(n + k) | O(n + k) | O(n + k) | yes |
| Radix sort (d digits, base b) | O(d(n + b)) | O(d(n + b)) | O(d(n + b)) | O(n + b) | yes |
| Bucket sort | O(n + k) | O(n + k) | O(n²) | O(n + k) | yes |
| **TimSort**: `Collections.sort`, `List.sort`, `Arrays.sort(Object[])` | O(n) | O(n log n) | O(n log n) | O(n) | yes |
| **Dual-pivot quicksort**: `Arrays.sort(int[])` etc. | O(n log n) | O(n log n) | O(n log n) on Java 14+ (heapsort fallback); O(n²) possible on older Java | O(log n) | n/a for primitives |

Any sort based on **comparisons** needs Ω(n log n) in the worst case (see [Hard & Unusual Cases](/notes/cx-hard-cases)). Counting / radix sort beat it by not comparing.

## Searching

| Technique | Time |
|---|---|
| linear search | O(n) |
| binary search on a sorted array | O(log n) |
| binary search on the answer | O(log(range) × cost of the check) |
| ternary search (unimodal function) | O(log n) |
| hash lookup | O(1) expected |
| balanced BST lookup | O(log n) |

## Common techniques

| Technique | Time | Space |
|---|---|---|
| two pointers | O(n) (after an O(n log n) sort, if needed) | O(1) |
| sliding window | O(n) | O(1) or O(alphabet) |
| prefix sums | O(n) build, O(1) per range query | O(n) |
| difference array | O(1) per range update, O(n) to rebuild | O(n) |
| monotonic stack / deque | O(n) | O(n) |
| Kadane (max subarray) | O(n) | O(1) |
| Boyer–Moore majority vote | O(n) | O(1) |
| Floyd cycle detection | O(n) | O(1) |
| bit tricks (`Integer.bitCount`, `x & -x`) | O(1) | O(1) |

---

## Graphs

| Algorithm | Time | Space |
|---|---|---|
| BFS / DFS (adjacency list) | O(V + E) | O(V) |
| BFS / DFS (adjacency matrix) | O(V²) | O(V²) for the matrix |
| BFS on an R × C grid | O(R · C) | O(R · C) |
| topological sort (Kahn / DFS) | O(V + E) | O(V) |
| cycle detection, bipartite check | O(V + E) | O(V) |
| connected components (DFS or union-find) | O(V + E) / O((V + E) α(V)) | O(V) |
| 0-1 BFS | O(V + E) | O(V) |
| Dijkstra with a binary heap | O((V + E) log V) | O(V + E) |
| Dijkstra with a plain array (dense graphs) | O(V²) | O(V) |
| Bellman–Ford | O(V · E) | O(V) |
| Floyd–Warshall | O(V³) | O(V²) |
| Prim (binary heap) | O(E log V) | O(V + E) |
| Kruskal | O(E log E) for sorting + O(E α(V)) | O(V) |
| Tarjan / Kosaraju (SCC), bridges, articulation points | O(V + E) | O(V) |
| union-find, per operation | O(α(n)) amortized | O(n) |

## Trees and heaps

| Operation | Time |
|---|---|
| traversal (pre / in / post / level order) | O(n) time, O(h) stack (O(width) queue for BFS) |
| BST search / insert / delete | O(h): O(log n) balanced, O(n) skewed |
| balanced BST (`TreeMap`, red-black, AVL) | O(log n) |
| binary heap: push / pop | O(log n) |
| binary heap: peek | O(1) |
| binary heap: build from n items | O(n) |
| segment tree: build / query / point update | O(n) / O(log n) / O(log n) |
| lazy segment tree: range update | O(log n) |
| Fenwick tree: query / update | O(log n) |
| trie: insert / search a word of length L | O(L) |
| LCA with binary lifting | O(n log n) preprocessing, O(log n) per query |

## Strings

| Algorithm | Time |
|---|---|
| naive pattern matching | O(n · m) |
| KMP | O(n + m) |
| Z-algorithm | O(n + m) |
| Rabin–Karp (rolling hash) | O(n + m) expected, O(n · m) worst |
| Manacher (all palindromes) | O(n) |
| expand-around-center palindromes | O(n²) |
| sorting n strings of length ≤ L | O(n · L · log n) |
| comparing two strings / `equals` | O(L) |
| building a string with `StringBuilder` | O(total length) |

## Math

| Algorithm | Time |
|---|---|
| GCD (Euclid) | O(log min(a, b)) |
| fast exponentiation | O(log exponent) |
| primality by trial division | O(√n) |
| prime factorisation by trial division | O(√n) |
| sieve of Eratosthenes up to n | O(n log log n) |
| all divisors | O(√n) |
| nCr with precomputed factorials mod p | O(n) once, then O(1) per query |
| k × k matrix exponentiation to power n | O(k³ log n) |

## Dynamic programming and backtracking

| Pattern | Time |
|---|---|
| any DP | **states × transitions per state** |
| 1D DP (stairs, robber) | O(n) |
| LIS (DP / patience sorting) | O(n²) / O(n log n) |
| LCS, edit distance | O(n · m) |
| 0/1 knapsack | O(n · W) (pseudo-polynomial) |
| interval DP (matrix chain, burst balloons) | O(n³) |
| bitmask DP (TSP) | O(2ⁿ · n²) |
| all subsets | O(n · 2ⁿ) |
| all permutations | O(n · n!) |
| combinations C(n, k) | O(k · C(n, k)) |

---

## Java collections (average case)

| Class | add / put | get / contains | remove | min / max | Notes |
|---|---|---|---|---|---|
| `int[]` | n/a | O(1) by index | n/a | O(n) | fastest, fixed size |
| `ArrayList` | O(1) amort. at end, O(n) in middle | O(1) index, O(n) contains | O(n), O(1) at end | O(n) | |
| `LinkedList` | O(1) at ends | O(n) | O(1) at ends | O(n) | rarely the right choice |
| `ArrayDeque` | O(1) amort. both ends | O(1) at ends, O(n) contains | O(1) at ends | O(n) | stack / queue |
| `PriorityQueue` | O(log n) | O(1) peek, O(n) contains | O(log n) poll, O(n) by value | O(1) one side | build O(n) |
| `HashMap` / `HashSet` | O(1) | O(1) | O(1) | O(n) | worst O(log n) per bucket |
| `LinkedHashMap` / `LinkedHashSet` | O(1) | O(1) | O(1) | O(n) | insertion / access order |
| `TreeMap` / `TreeSet` | O(log n) | O(log n) | O(log n) | O(log n) | floor / ceiling O(log n) |

More detail per class: [Java Collections](/notes/java-collections).

**Next:** [7. Hidden Costs in Java](/notes/cx-java-costs)
