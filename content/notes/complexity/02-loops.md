# Counting Loops

> **Level:** Easy · **Part 2 of 8** in Time & Space Complexity
>
> **TL;DR**: find the line that runs the most, and count how many times it runs as a function of n. Loops that **add** to `i` give n, loops that **multiply** `i` give log n, nested loops **multiply**, loops one after another **add**, and a pointer that never moves backwards is O(n) in total no matter how it's nested.

---

## The method (works for every loop)

1. Pick the **innermost** statement: it runs the most.
2. Ask: **how many times does it run**, in terms of the input size?
3. If the count depends on the outer loop's variable, write it as a **sum** and simplify.
4. Drop constants and smaller terms.

Each pattern below is a version of this.

---

## 1. One loop, step +1 → O(n)

```java
for (int i = 0; i < n; i++) sum += a[i];      // runs n times
```

Step +2, +5, +k: `n / k` times, still **O(n)** (k is a constant).

## 2. Loops one after another → add

```java
for (int i = 0; i < n; i++) ...      // n
for (int j = 0; j < m; j++) ...      // m
// total: O(n + m). If m == n it's O(2n) = O(n). Never O(n · m).
```

## 3. Nested loops, independent → multiply

```java
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        work();                       // n · m times → O(n · m), O(n²) when m == n
```

## 4. Nested loops, inner depends on outer (the triangle) → still O(n²)

```java
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)   // every pair (i, j) with i < j
        work();
```

Count: when i = 0 the inner runs n−1 times, then n−2, …, 1, 0:

```
(n-1) + (n-2) + ... + 1 + 0 = n(n-1)/2  ≈  n²/2   →   O(n²)
```

Visiting "only half the pairs" halves the constant; the growth is still quadratic.

Three nested loops `i < j < k` give n(n−1)(n−2)/6 → **O(n³)**.

## 5. Multiply or divide the loop variable → O(log n)

```java
for (int i = 1; i < n; i *= 2) work();    // i = 1, 2, 4, 8, ...
for (int i = n; i > 0; i /= 2) work();    // i = n, n/2, n/4, ...
```

After k steps `i = 2ᵏ`. The loop stops when `2ᵏ ≥ n`, so `k = log₂ n`. Plain English: **"how many times can I halve n before it reaches 1?"** About 20 for a million, about 30 for a billion. That's why binary search is so fast.

Same for any constant factor: `i *= 3` → log₃ n, still **O(log n)**.

Digit loops are the same pattern: `while (n > 0) n /= 10;` runs once per digit: **O(log₁₀ n)**.

## 6. A loop until `i * i > n` → O(√n)

```java
for (int i = 1; (long) i * i <= n; i++) if (n % i == 0) ...   // divisors, primality
```

It stops when `i` reaches √n, so it runs **√n** times. For n = 10⁹ that's only ~31,623 steps.

## 7. Log loop inside a linear loop → O(n log n)

```java
for (int i = 0; i < n; i++)
    for (int j = 1; j < n; j *= 2)
        work();                       // n · log n
```

Also: n calls of an O(log n) operation (`TreeMap.put`, `PriorityQueue.offer`, binary search) → **O(n log n)**.

## 8. Two pointers / sliding window: nested-looking but O(n)

```java
int j = 0;
for (int i = 0; i < n; i++) {
    while (j < n && ok(i, j)) j++;    // j only moves forward, never resets
}
```

The inner `while` can run many times for one `i` and zero times for another, but `j` **never moves backwards** and stops at n. Across the whole program it advances at most n times. Total: n (outer) + n (all inner steps) = **O(n)**.

This "count the total movement of the pointer, not per iteration" trick is called **aggregate analysis**. It also explains why the monotonic stack is O(n): each element is pushed once and popped at most once. More in [Amortized Analysis](/notes/cx-amortized).

## 9. Early exit doesn't change the worst case

```java
for (int i = 0; i < n; i++) if (a[i] == target) return i;   // could stop at i = 0 ...
return -1;                                                  // ... but worst case is n → O(n)
```

## 10. A method call inside a loop costs what the method costs

```java
for (int i = 0; i < n; i++)
    if (list.contains(x)) ...         // contains is O(n) → total O(n²)

for (int i = 0; i < n; i++)
    s = s + "a";                      // building a new string of length i → O(n²) total

for (int i = 0; i < n; i++)
    Arrays.sort(copy);                // O(n log n) each → O(n² log n)
```

The most common way to accidentally write an O(n²) solution in Java is a hidden O(n) call inside an O(n) loop. See [Hidden Costs in Java](/notes/cx-java-costs).

## 11. Loops whose bounds aren't n

```java
for (int c = 0; c < 26; c++) ...                 // O(26) = O(1): a constant alphabet
for (int mask = 0; mask < (1 << n); mask++) ...  // 2ⁿ iterations: exponential!
for (int len = 1; len <= n; len++)               // all substrings: O(n²) of them,
    for (int i = 0; i + len <= n; i++) ...       // O(n³) if each one is copied or scanned
```

When a bound is a constant like 26 or 4 (grid directions), you can drop it, but mention it if it's large (e.g. "O(26 · n)").

---

## Summary table

| Loop shape | Count | Big-O |
|---|---|---|
| `i++` to n | n | O(n) |
| `i += k` to n | n / k | O(n) |
| `i *= 2` or `i /= 2` | log₂ n | O(log n) |
| `i * i <= n` | √n | O(√n) |
| two loops in sequence | n + m | O(n + m) |
| two nested loops | n · m | O(n · m) |
| nested `j` from `i + 1` | n(n−1)/2 | O(n²) |
| outer n, inner `j *= 2` | n log n | O(n log n) |
| pointer that never goes back | ≤ 2n total | O(n) |
| `mask < 1 << n` | 2ⁿ | O(2ⁿ) |

Trickier shapes (harmonic loops, `i = i * i`, outer halving with inner `i` steps, sieves) are in [Hard & Unusual Cases](/notes/cx-hard-cases).

---

## Practice: say the complexity before reading the answer

```java
// A
for (int i = 0; i < n; i++) for (int j = 0; j < i * i; j++) work();
// B
for (int i = 1; i <= n; i *= 2) for (int j = 0; j < n; j++) work();
// C
int i = 0, j = n - 1; while (i < j) { if (a[i] + a[j] < t) i++; else j--; }
// D
for (int i = 0; i < n; i++) for (int j = 0; j < 100; j++) work();
```

Answers: **A** O(n³) (sum of i² ≈ n³/3). **B** O(n log n) (log n outer × n inner). **C** O(n) (the gap `j − i` shrinks by 1 each step). **D** O(n) (100 is a constant).

**Next:** [3. Space Complexity](/notes/cx-space)
