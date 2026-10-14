# Hard & Unusual Cases

> **Level:** Hard · **Part 8 of 8** in Time & Space Complexity
>
> **TL;DR**: code that *looks* O(n²) can be O(n log n) or O(n), and code that looks O(log n) can be O(n) or worse. Each case below shows the code, the tempting wrong answer, the right answer, and **how we find it**: write the work as a sum or recurrence, then simplify with a handful of known sums. At the end, a program that measures complexity for you.

---

## The method, step by step

1. **Name the sizes**: n, m, V, E, string length L, the numeric value N … Don't merge different ones.
2. **Find the dominant operation**: the line that runs the most.
3. **Write its count exactly**: a **sum** for loops, a **recurrence** for recursion.
4. **Simplify** with the known sums below.
5. **If a loop looks expensive, count per element instead**: how many times can one element be pushed / popped / moved? (amortized)
6. **Price every method call** at its real cost ([Hidden Costs in Java](/notes/cx-java-costs)).
7. **Verify by measurement** with the doubling experiment at the end of this note.

### Known sums (the toolbox)

| Sum | Value | Big-O |
|---|---|---|
| 1 + 2 + 3 + … + n (arithmetic) | n(n + 1)/2 | O(n²) |
| 1² + 2² + … + n² | n(n + 1)(2n + 1)/6 | O(n³) |
| 1 + 2 + 4 + … + n (geometric, up) | < 2n | O(n) |
| n + n/2 + n/4 + … + 1 (geometric, down) | < 2n | O(n) |
| 1 + 1/2 + 1/3 + … + 1/n (harmonic) | ≈ ln n | O(log n) |
| 1/2 + 1/3 + 1/5 + 1/7 + … (primes ≤ n) | ≈ ln ln n | O(log log n) |
| log 1 + log 2 + … + log n = log(n!) | ≈ n log n − n | O(n log n) |
| C(n, 0) + C(n, 1) + … + C(n, n) | 2ⁿ | O(2ⁿ) |
| Σₖ C(n, k) · 2ᵏ | 3ⁿ | O(3ⁿ) |

**Rule of thumb for geometric series:** if each term is a constant fraction of the previous one, the whole sum is a constant times the **biggest** term.

---

## Part A: loops

### A1. The harmonic loop: O(n log n), not O(n²)

```java
for (int i = 1; i <= n; i++)
    for (int j = i; j <= n; j += i)      // visits every multiple of i
        work();
```

- **Looks like:** two nested loops up to n → O(n²).
- **Actually:** **O(n log n)**.
- **How we find it:** for a fixed i the inner loop runs n / i times. Total = n/1 + n/2 + n/3 + … + n/n = n · (1 + 1/2 + … + 1/n) = n · Hₙ ≈ n ln n. The harmonic sum grows like ln n because it's roughly the area under the curve 1/x from 1 to n.
- **Where it appears:** "for every number, add it to all of its multiples": sum of divisors for 1 … n, counting divisors, sieve-like precomputation.

### A2. Sieve of Eratosthenes: O(n log log n)

```java
boolean[] composite = new boolean[n + 1];
for (int p = 2; (long) p * p <= n; p++)
    if (!composite[p])
        for (int m = p * p; m <= n; m += p) composite[m] = true;
```

- **Looks like:** the harmonic loop → O(n log n).
- **Actually:** **O(n log log n)**, practically linear (for n = 10⁷, ln ln n ≈ 2.8).
- **How we find it:** the inner loop only runs for **primes** p, about n / p times each. Total ≈ n · (1/2 + 1/3 + 1/5 + 1/7 + …). The sum of reciprocals of primes up to n grows like ln ln n (Mertens' theorem), much slower than the harmonic sum because primes thin out.

### A3. Outer loop halves, inner loop runs `i` times: O(n)

```java
for (int i = n; i > 0; i /= 2)
    for (int j = 0; j < i; j++)
        work();
```

- **Looks like:** log n outer × n inner → O(n log n).
- **Actually:** **O(n)**.
- **How we find it:** the inner counts are n, n/2, n/4, …, 1. A shrinking geometric series is less than twice its first term: < 2n.
- **Contrast:** if the inner loop runs to `n` (not `i`), every level costs n and there are log n levels → O(n log n). The bound of the inner loop is everything.

### A4. Inner loop only on powers of two: O(n)

```java
for (int i = 1; i <= n; i++)
    if ((i & (i - 1)) == 0)              // true only when i is a power of two
        for (int j = 0; j < i; j++) work();
```

- **Looks like:** O(n²).
- **Actually:** **O(n)**: the expensive inner loop runs only for i = 1, 2, 4, …, and 1 + 2 + 4 + … + n < 2n. Plus n for the outer loop.
- **Why it matters:** this is exactly why `ArrayList.add` is O(1) amortized: the O(i) copy only happens when the size hits the next growth point.

### A5. `i = i * i`: O(log log n)

```java
for (long i = 2; i <= n; i = i * i) work();
```

- **How we find it:** i goes 2, 4, 16, 256, 65536, 2³², … that is `i = 2^(2^k)`. It stops when `2^(2^k) > n`, i.e. `2^k > log₂ n`, i.e. `k > log₂ log₂ n`. For n = 10¹⁸ that's about **6** iterations.

### A6. Triangular steps: O(√n)

```java
int i = 0;
long s = 0;
while (s <= n) { i++; s += i; }          // s = 1, 3, 6, 10, 15, ...
```

- **How we find it:** after k steps, s = k(k + 1)/2 ≈ k²/2. The loop stops when k²/2 > n, so k ≈ √(2n) → **O(√n)**.

### A7. Every submask of every mask: O(3ⁿ), not O(4ⁿ)

```java
for (int mask = 0; mask < (1 << n); mask++)
    for (int sub = mask; sub > 0; sub = (sub - 1) & mask)   // walks all non-empty submasks of mask
        work(mask, sub);
```

- **Looks like:** 2ⁿ masks × 2ⁿ submasks = 4ⁿ.
- **Actually:** **O(3ⁿ)**. For n = 15: 1.4 × 10⁷ instead of 10⁹.
- **How we find it, two ways:**
  - A mask with k bits has 2ᵏ submasks, and C(n, k) masks have k bits: Σₖ C(n, k) · 2ᵏ = (1 + 2)ⁿ = 3ⁿ by the binomial theorem.
  - Per bit: each of the n bits is in exactly one of 3 states (not in mask / in mask only / in both). 3 choices, n times.

### A8. Looping over every adjacency list: O(V + E), not O(V · E) or O(V²)

```java
for (int u = 0; u < V; u++)
    for (int v : adj.get(u))
        work(u, v);
```

- **How we find it:** the inner loop runs deg(u) times. The sum of all degrees is 2E for an undirected graph (every edge is counted from both ends: the handshake lemma), E for a directed one. Total: V (outer) + 2E (inner) → **O(V + E)**.

### A9. Subtraction GCD vs modulo GCD

```java
long gcdSlow(long a, long b) {           // O(max(a, b)): gcd(10^9, 1) takes 10^9 steps
    while (a != b) if (a > b) a -= b; else b -= a;
    return a;
}
long gcd(long a, long b) {               // O(log min(a, b))
    return b == 0 ? a : gcd(b, a % b);
}
```

- **How we find the log bound:** if b ≤ a then `a % b < a / 2` (either b ≤ a/2 and the remainder is < b, or b > a/2 and the remainder is a − b < a/2). So the larger number at least halves every two steps → O(log). The worst inputs are consecutive Fibonacci numbers (Lamé's theorem).

---

## Part B: recursion

### B1. Fast power written wrong: O(n), not O(log n)

```java
long pow(long x, int n) {                // O(log n)
    if (n == 0) return 1;
    long half = pow(x, n / 2);           // computed ONCE
    return n % 2 == 0 ? half * half : half * half * x;
}

long powSlow(long x, int n) {            // O(n)!
    if (n == 0) return 1;
    if (n % 2 == 0) return powSlow(x, n / 2) * powSlow(x, n / 2);   // the same half, computed twice
    return x * powSlow(x, n - 1);
}
```

- **How we find it:** `pow` is `T(n) = T(n/2) + 1` → O(log n). `powSlow` is `T(n) = 2T(n/2) + 1`: Master theorem with a = 2, b = 2, c* = 1 > 0 → **Θ(n)**. Two half-size calls rebuild a full tree with n leaves; storing `half` in a variable collapses it to a chain.

### B2. `f(n-1) + f(n-1)` vs `2 * f(n-1)`

```java
long a(int n) { return n == 0 ? 1 : a(n - 1) + a(n - 1); }   // O(2ⁿ): T(n) = 2T(n-1) + 1
long b(int n) { return n == 0 ? 1 : 2 * b(n - 1); }          // O(n):  T(n) = T(n-1) + 1
```

Same answer, wildly different cost. **Count the recursive calls in the body**: two calls on n − 1 is exponential.

### B3. A loop inside the recursion

```java
void f(int n) { if (n <= 0) return; loop(n); f(n - 1); }           // n + (n-1) + ... = O(n²)
void g(int n) { if (n <= 1) return; loop(n); g(n / 2); g(n / 2); } // 2T(n/2) + n = O(n log n)
void h(int n) { if (n <= 1) return; loop(n); h(n / 2); }           // T(n/2) + n  = n + n/2 + ... = O(n)
void k(int n) { if (n <= 0) return; k(n - 1); k(n - 1); }          // 2T(n-1) + 1 = O(2ⁿ)
// loop(n) = an O(n) loop
```

`h` is the surprise: halving the problem each time while doing linear work is still **linear** (geometric series), e.g. quickselect with good pivots.

### B4. Unequal split: `T(n) = T(n/3) + T(2n/3) + n` → O(n log n)

The Master theorem needs equal parts, so use a **recursion tree**:

- Each level's pieces add up to at most n, so each level costs ≤ n.
- The shortest root-to-leaf path divides by 3 each time: log₃ n levels. The longest divides by 3/2: log₃⁄₂ n levels.
- So the total is between n · log₃ n and n · log₃⁄₂ n → **Θ(n log n)**.

**Lesson:** quicksort with any **constant-fraction** split (even 1% / 99%) is still O(n log n); only the constant changes (log₁₀₀⁄₉₉ n ≈ 69 · log₂ n: large, but logarithmic). It's O(n²) only when one side is **constant-size**, like 0 and n − 1.

### B5. `T(n) = T(√n) + 1` → O(log log n)

- **How we find it (change of variable):** let n = 2ᵐ, so √n = 2^(m/2). Define S(m) = T(2ᵐ). Then S(m) = S(m/2) + 1, which is binary search: S(m) = O(log m). Since m = log n: **T(n) = O(log log n)**.
- The same trick on `T(n) = 2T(√n) + log n` gives S(m) = 2S(m/2) + m = O(m log m), so **T(n) = O(log n · log log n)**.
- **Where it appears:** van Emde Boas trees, and the `i = i * i` loop (A5).

### B6. Checking a balanced binary tree the naive way: O(n²) worst case

```java
boolean isBalanced(TreeNode r) {                   // calls height() at every node
    if (r == null) return true;
    return Math.abs(height(r.left) - height(r.right)) <= 1 && isBalanced(r.left) && isBalanced(r.right);
}
int height(TreeNode r) { return r == null ? 0 : 1 + Math.max(height(r.left), height(r.right)); }
```

- **How we find it:** `height` of a subtree of size s costs O(s), and it's called once at every node. For a **balanced** tree: T(n) = 2T(n/2) + n → O(n log n). For a **skewed** (chain-like) tree: T(n) = T(n − 1) + n → **O(n²)**.
- **Fix:** return the height and "balanced?" in one post-order pass (e.g. height −1 for "unbalanced") → O(n). The general lesson: **don't recompute a subtree property at every ancestor; return it upwards.**

### B7. Recursion that copies its input

```java
int sum(int[] a) {                                  // O(n²): every level copies the rest of the array
    if (a.length == 0) return 0;
    return a[0] + sum(Arrays.copyOfRange(a, 1, a.length));
}
```

T(n) = T(n − 1) + n → O(n²) time **and** O(n²) total allocation. Pass an index instead. The same goes for `s.substring(1)` and `new ArrayList<>(list.subList(…))` in recursive calls.

---

## Part C: when "n" isn't the real input size

### C1. Trial division is exponential in the input size

```java
boolean isPrime(long N) {
    if (N < 2) return false;
    for (long d = 2; d * d <= N; d++) if (N % d == 0) return false;
    return true;
}
```

O(√N) sounds fast, but for N = 10¹⁸ that's 10⁹ steps. The **input** is a single number written with only about 60 bits, and √N = 2^(bits / 2): **exponential in the number of bits**. For huge N, use Miller–Rabin (O(k · log³ N)).

### C2. Pseudo-polynomial DP

0/1 knapsack is O(n · W). With W = 10⁴ it's instant; with W = 10⁹ it's impossible, even though n is tiny. The running time is polynomial in the **value** W but exponential in its **number of digits**. Escape routes:

- swap the DP dimension (e.g. "minimum weight for each total value" if values are small),
- **meet in the middle**: split n ≤ 40 items into two halves, enumerate 2^(n/2) sums each, sort one and binary search: O(2^(n/2) · n).

### C3. Output-sensitive bounds: you can't beat the answer's size

Listing all subsets of 20 items means writing 2²⁰ ≈ 10⁶ lists averaging 10 elements: about 10⁷ numbers. No algorithm can do it faster than it can write the output. So "generate all X" problems are judged against **output size**, and the right claim is "O(n · 2ⁿ), which is optimal".

### C4. Operations on big numbers aren't O(1)

`BigInteger` multiplication of two d-digit numbers is O(d²) for small d (Java switches to Karatsuba and Toom–Cook for very large ones). Computing 1000! with `BigInteger` multiplies numbers with thousands of digits a thousand times: far from "1000 operations".

---

## Part D: data-structure surprises

| Case | Naive claim | Truth | Why |
|---|---|---|---|
| Dijkstra with lazy deletion | O((V + E) log V) | O(E log E) = **O(E log V)** | the heap may hold one entry per edge; since E ≤ V², log E ≤ 2 log V |
| union-find with both optimisations | O(log n) | **O(α(n))** amortized | α(n) ≤ 4 for any n below 2^65536 |
| `HashMap` get | O(1) | O(1) **expected**; O(n) worst, O(log n) after Java 8 treeify | adversarial keys can collide on purpose |
| `HashMap<String, …>` get | O(1) | **O(L)** | hashing and `equals` read the whole key |
| sorting n strings | O(n log n) | **O(n · L · log n)** | each comparison is O(L) |
| Word Ladder (N words, length L) | O(N · 26 · L) | **O(N · 26 · L²)** | each of the 26 · L neighbour strings costs O(L) to build and hash |
| `ArrayList.add` | O(1) | O(1) **amortized**, O(n) for one unlucky call | resizing |
| quickselect | O(n) | O(n) **expected**, O(n²) worst | pivot luck; median-of-medians gives O(n) worst |
| `Arrays.sort(int[])` on Java ≤ 13 | O(n log n) | **O(n²)** on crafted input | anti-quicksort tests; Java 14+ falls back to heapsort |

---

## Part E: lower bounds (why you can't do better)

### Comparison sorting needs Ω(n log n)

A comparison sort is a **decision tree**: each comparison answers yes / no and branches. To sort, it must be able to end in any of the **n!** possible orderings, so the tree needs at least n! leaves. A binary tree with n! leaves has height at least log₂(n!), and

```
log₂(n!) = log₂ 1 + log₂ 2 + ... + log₂ n  ≥  (n/2) · log₂(n/2)   (the top half of the terms are each ≥ log₂(n/2))
```

so **every** comparison sort needs Ω(n log n) comparisons in the worst case. Counting sort and radix sort escape this only because they don't compare; they use the values as indices.

### Searching a sorted array needs Ω(log n)

Each comparison at best halves the remaining candidates, and there are n of them: at least log₂ n comparisons.

---

## Part F: genuinely strange ones

### F1. Regex that takes forever

```java
"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!".matches("(a+)+b");   // 30 a's: can take seconds or longer
```

Java's regex engine **backtracks**. `(a+)+` can split a run of n a's into groups in 2ⁿ⁻¹ ways, and when the final `b` fails to match, it tries every one of them: **O(2ⁿ)**. This "catastrophic backtracking" has taken down real websites. Avoid nested quantifiers on untrusted input, or write the matching by hand.

### F2. Nobody knows the complexity

```java
int steps(long n) {                       // the Collatz (3n + 1) process
    int s = 0;
    while (n != 1) { n = (n % 2 == 0) ? n / 2 : 3 * n + 1; s++; }
    return s;
}
```

It's an open problem in mathematics whether this loop **ends** for every starting n, so no one can state its complexity. Experimentally it finishes within a few thousand steps for every n ever tested (all numbers up to about 2⁶⁸ have been checked). A reminder that "analyse the loop" sometimes means "prove a theorem".

---

## Part G: measure it: the doubling experiment

When the math is unclear, **count operations** for n, 2n, 4n, … and look at the ratio between consecutive counts. Counting is more reliable than timing (no JIT warm-up or GC noise).

```java
public class Doubling {
    static long ops;

    static void algorithm(int n) {                 // paste the code you want to analyse; do ops++ in the hot spot
        for (int i = 1; i <= n; i++)
            for (int j = i; j <= n; j += i)
                ops++;
    }

    public static void main(String[] args) {
        long prev = 0;
        for (int n = 1 << 10; n <= 1 << 22; n <<= 1) {
            ops = 0;
            algorithm(n);
            System.out.printf("n=%9d  ops=%14d  ratio=%.3f%n", n, ops, prev == 0 ? 0.0 : (double) ops / prev);
            prev = ops;
        }
    }
}
```

How to read the ratio when n doubles:

| Ratio of ops (2n vs n) | Complexity |
|---|---|
| ≈ 1, but the count grows by a constant amount each time | O(log n) |
| ≈ 1.41 (√2) | O(√n) |
| ≈ 2 | O(n) |
| a bit above 2, slowly falling toward 2 (2.2, 2.18, 2.17 …) | O(n log n) |
| ≈ 4 | O(n²) |
| ≈ 8 | O(n³) |
| keeps growing (4, 16, 256 …) | exponential |

For the harmonic loop above you'll see ratios of about 2.18 at the start, sliding to about 2.09 by n = 4 million: the signature of **n log n**. Timing works the same way (`System.nanoTime()`), but run each size a few times and ignore the first runs while the JIT warms up.

---

**Back to start:** [1. What Big-O Really Means](/notes/cx-big-o)
