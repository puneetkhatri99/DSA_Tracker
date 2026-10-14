# Amortized Analysis

> **Level:** Medium · **Part 5 of 8** in Time & Space Complexity
>
> **TL;DR**: some operations are occasionally expensive but cheap **on average over any sequence**. Amortized cost = total cost of the sequence ÷ number of operations. It's a hard guarantee (no luck involved), and it's why `ArrayList.add`, `HashMap.put`, monotonic stacks, sliding windows and union-find are fast.

---

## In plain English

A yearly gym membership costs a lot **once**, but spread over 300 visits it's cheap per visit. You don't say "going to the gym costs ₹12,000"; you say "about ₹40 a visit".

`ArrayList.add` is the same: almost every add is one write, but now and then the array is full and **all** elements are copied into a bigger one. That copy is expensive, but it happens so rarely that the average stays constant.

### Amortized is not "average case"

| | Average case | Amortized |
|---|---|---|
| averaged over | random **inputs** | a **sequence of operations** on any input |
| needs luck / randomness? | yes: a bad input can be slow | no: guaranteed for every sequence |
| example | quicksort is O(n log n) on random data | n `ArrayList.add`s always cost O(n) in total |

But amortized O(1) still allows **one** call to be O(n). That matters for latency-sensitive systems (a game frame, a trading engine), not for total running time.

---

## Three ways to prove it

### 1. Aggregate method: add everything up

**Dynamic array that doubles** (start at capacity 1, double when full). n pushes cost:

```
writes:  n
copies:  1 + 2 + 4 + ... + n/2 + n  <  2n      (a geometric series)
total:   < 3n   →   O(1) amortized per push
```

(`ArrayList` grows 1.5x instead of 2x; the series is n + n/1.5 + n/1.5² + … ≈ 3n copies, still O(1) per push.)

### 2. Accounting (banker's) method: prepay with coins

Charge every push **3 coins** instead of 1:
- 1 coin pays for writing the new element,
- 2 coins are saved on that element.

When the array of size k is full and doubles, the k/2 elements added since the last doubling have saved k/2 × 2 = **k coins**: exactly enough to copy all k elements. The bank never goes negative, so 3 coins per push = **O(1) amortized**.

### 3. Potential method: the math version

Define a "potential" Φ (stored energy) of the structure, e.g. `Φ = 2·size − capacity`. Amortized cost = actual cost + ΔΦ. Cheap pushes raise Φ by 2; an expensive resize's copying is paid by the drop in Φ. Good for formal proofs; the first two methods are enough for interviews.

---

## Where you meet amortized costs

| Structure / pattern | One operation, worst case | Amortized | Why |
|---|---|---|---|
| `ArrayList.add`, `ArrayDeque.offer` | O(n) (resize) | O(1) | geometric growth |
| `HashMap.put` | O(n) (rehash) | O(1) expected | table doubles at 75% full |
| `StringBuilder.append` | O(n) | O(1) per char | capacity grows to about 2x + 2 |
| monotonic stack (next greater element) | O(n) pops in one step | O(1) per element | each element pushed once, popped at most once |
| sliding window / two pointers | O(n) inner `while` | O(1) per step | the left pointer only moves forward, ≤ n times total |
| queue built from two stacks | O(n) transfer | O(1) | each element moves from `in` to `out` at most once |
| union-find (path compression + union by rank) | O(log n) | O(α(n)) ≈ O(1) | paths flatten as you use them |
| splay tree | O(n) | O(log n) | rotations pay for themselves |

### Monotonic stack: "the inner loop is O(n), so it's O(n²)?" No.

```java
int[] nextGreater(int[] a) {
    int[] res = new int[a.length];
    Arrays.fill(res, -1);
    Deque<Integer> st = new ArrayDeque<>();
    for (int i = 0; i < a.length; i++) {
        while (!st.isEmpty() && a[st.peek()] < a[i]) res[st.pop()] = a[i];   // can pop many at once
        st.push(i);
    }
    return res;
}
```

One iteration can pop O(n) elements. But count **from the element's point of view**: every index is pushed exactly once and popped at most once. Total pushes + pops ≤ 2n → **O(n)**.

### Queue from two stacks (LeetCode 232)

```java
class MyQueue {
    private final Deque<Integer> in = new ArrayDeque<>(), out = new ArrayDeque<>();

    public void push(int x) { in.push(x); }

    public int pop() { peek(); return out.pop(); }

    public int peek() {
        if (out.isEmpty()) while (!in.isEmpty()) out.push(in.pop());   // O(n) sometimes...
        return out.peek();
    }
}
```

An element is moved from `in` to `out` **at most once** in its life, so n operations do at most about 4n stack operations: O(1) amortized.

### Union-Find: almost constant

```java
int find(int x) {
    while (parent[x] != x) {
        parent[x] = parent[parent[x]];   // path halving: point to the grandparent
        x = parent[x];
    }
    return x;
}
void union(int a, int b) {
    a = find(a); b = find(b);
    if (a == b) return;
    if (rank[a] < rank[b]) { int t = a; a = b; b = t; }
    parent[b] = a;                       // attach the shorter tree under the taller
    if (rank[a] == rank[b]) rank[a]++;
}
```

| Optimisations | Cost per operation |
|---|---|
| none | O(n) worst (a long chain) |
| union by rank/size only | O(log n) |
| path compression only | O(log n) amortized |
| both | **O(α(n))** amortized: α is the inverse Ackermann function, ≤ 4 for any n you'll ever see |

---

## A trap: shrinking can break amortization

Suppose a dynamic array **doubles** when full and **halves** when it drops to half full. Now sit right at the boundary and alternate `add, remove, add, remove`: every `add` triggers a grow (O(n)) and every `remove` a shrink (O(n)). That's **O(n) per operation**, forever.

The fix is a gap between the thresholds: grow at full, **shrink at a quarter full** (to half). After any resize the array is half full, so at least n/4 cheap operations must happen before the next resize. (Java's `ArrayList` simply never shrinks automatically.)

---

## How to spot an amortized argument

Ask: **"Can the expensive thing happen to the same element more than a constant number of times?"**

- Each element is pushed/popped/moved/copied a bounded number of times → the total is O(n) even if one step looks expensive.
- A pointer only moves in one direction → its total movement is ≤ n.
- A cost that doubles and a gap that doubles (array resizing) → geometric series → O(1) average.

**Next:** [6. Cheat Sheet: Algorithms & Collections](/notes/cx-cheatsheet)
