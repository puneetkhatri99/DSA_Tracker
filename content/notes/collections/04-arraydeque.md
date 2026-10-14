# ArrayDeque: Stack & Queue

> **Level:** Easy · **Part 4 of 16** in Java Collections
>
> **In one line:** a circular array that adds and removes at **both ends** in O(1). It is the right class for every stack, every queue and every deque in DSA. It replaces `Stack` and `LinkedList`.

---

## In plain English

"Deque" (say "deck") = **d**ouble-**e**nded **que**ue: a line where people can join or leave at the front *and* the back.

- Use only the front → it's a **stack** (last in, first out, like a pile of plates).
- Join at the back, leave from the front → it's a **queue** (first in, first out, like a ticket line).

Inside is a **round table** instead of a straight row. Two markers say where the line starts (`head`) and where the next person sits (`tail`). When someone leaves the front, nobody shuffles: the `head` marker just moves one seat. When the line reaches the end of the array, it wraps around to seat 0. That's why both ends are O(1).

---

## How it works inside

```java
// Simplified from java.util.ArrayDeque (JDK 11+)
public class ArrayDeque<E> {
    transient Object[] elements;   // the round table; at least one slot is always empty
    transient int head;            // index of the first element
    transient int tail;            // index where the NEXT addLast goes

    public void addFirst(E e) {
        if (e == null) throw new NullPointerException();
        elements[head = dec(head, elements.length)] = e;   // step head back one seat (wrapping)
        if (head == tail) grow(1);                         // table full: make it bigger
    }

    public void addLast(E e) {
        if (e == null) throw new NullPointerException();
        elements[tail] = e;
        if (head == (tail = inc(tail, elements.length))) grow(1);
    }

    public E pollFirst() {
        E e = (E) elements[head];
        if (e != null) {                    // null means "empty slot", so the deque is empty
            elements[head] = null;
            head = inc(head, elements.length);
        }
        return e;
    }

    static int inc(int i, int len) { return ++i >= len ? 0 : i; }       // i + 1 with wrap-around
    static int dec(int i, int len) { return --i < 0 ? len - 1 : i; }    // i - 1 with wrap-around
}
```

### Walkthrough (imagine capacity 8)

| Step | Array slots `[0 … 7]` | head | tail | Logical order |
|---|---|---|---|---|
| start | `[_ _ _ _ _ _ _ _]` | 0 | 0 | empty |
| `addLast(10)`, `addLast(20)`, `addLast(30)` | `[10 20 30 _ _ _ _ _]` | 0 | 3 | 10 20 30 |
| `addFirst(5)` | `[10 20 30 _ _ _ _ 5]` | **7** (wrapped) | 3 | 5 10 20 30 |
| `pollFirst()` → 5 | `[10 20 30 _ _ _ _ _]` | 0 | 3 | 10 20 30 |
| `pollLast()` → 30 | `[10 20 _ _ _ _ _ _]` | 0 | 2 | 10 20 |

Key facts:

- **No shifting, no node objects.** Each operation moves an index and writes one slot.
- **`null` is forbidden** because an empty slot *is* `null`. That's how `pollFirst` knows the deque is empty, and why `push(null)` throws an NPE.
- **Growing**: when `head` meets `tail`, the table is full. A bigger array is made (about 2x while small, 1.5x once large) and the wrapped part is copied so the elements are contiguous again. O(n) once in a while, O(1) amortised.
- `new ArrayDeque<>()` starts with room for 16. Java 8 kept the size a power of two and wrapped with `& (length - 1)`; Java 11+ wraps with the compare shown above.

---

## The API

```java
Deque<Integer> dq = new ArrayDeque<>();

// Deque, both ends
dq.offerFirst(1);  dq.offerLast(2);       // add (the add* variants throw on failure)
dq.peekFirst();    dq.peekLast();         // look (null if empty)
dq.pollFirst();    dq.pollLast();         // remove (null if empty)
dq.size(); dq.isEmpty();

// As a STACK (the top is the head)
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1); stack.push(2);             // addFirst
stack.peek();                             // 2 (peekFirst)
stack.pop();                              // 2 (removeFirst, throws if empty)

// As a QUEUE (FIFO: add at the tail, remove from the head)
Queue<Integer> queue = new ArrayDeque<>();
queue.offer(1); queue.offer(2);           // offerLast
queue.peek();                             // 1
queue.poll();                             // 1 (null if empty)
```

### Queue method pairs (throw vs return a special value)

| Operation | Throws an exception | Returns special value |
|---|---|---|
| Insert | `add(e)` | `offer(e)` returns `false` |
| Remove head | `remove()` | `poll()` returns `null` |
| Examine head | `element()` | `peek()` returns `null` |

---

## Why not `Stack` / `Vector`

`Stack extends Vector`. Every method is `synchronized` (lock overhead you don't need), it inherits index methods like `get(i)` and `add(i, x)` that break the stack idea, and even its Javadoc says to prefer `Deque`. The same goes for `Hashtable`: use `HashMap`.

| Intent | Legacy `Stack` / `Queue` call | `ArrayDeque` equivalent | Empty behaviour |
|---|---|---|---|
| push onto stack | `stack.push(x)` | `dq.push(x)` = `addFirst(x)` | n/a |
| pop from stack | `stack.pop()` | `dq.pop()` = `removeFirst()` | throws `NoSuchElementException` |
| pop, safe | none | `dq.pollFirst()` / `dq.poll()` | returns `null` |
| peek stack top | `stack.peek()` | `dq.peek()` = `peekFirst()` | `null` (Stack **throws** `EmptyStackException`) |
| enqueue | `queue.offer(x)` / `add(x)` | `dq.offer(x)` = `offerLast(x)` | n/a |
| dequeue | `queue.poll()` | `dq.poll()` = `pollFirst()` | returns `null` |
| queue front | `queue.peek()` | `dq.peek()` = `peekFirst()` | returns `null` |
| back of queue | none | `dq.peekLast()` | returns `null` |
| is empty | `stack.empty()` / `isEmpty()` | `dq.isEmpty()` | |

---

## Classic patterns

```java
// 1. Valid Parentheses (stack)
boolean isValid(String s) {
    Deque<Character> st = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        if (c == '(') st.push(')');
        else if (c == '[') st.push(']');
        else if (c == '{') st.push('}');
        else if (st.isEmpty() || st.pop() != c) return false;
    }
    return st.isEmpty();
}

// 2. BFS level by level (queue)
Queue<int[]> bfs = new ArrayDeque<>();
bfs.offer(new int[]{sr, sc});
while (!bfs.isEmpty()) {
    int sz = bfs.size();                  // freeze the level size
    for (int i = 0; i < sz; i++) {
        int[] cur = bfs.poll();
        // expand neighbours with bfs.offer(...)
    }
}

// 3. Next Greater Element (monotonic stack): each index is pushed once and popped once -> O(n)
int[] nextGreater(int[] a) {
    int[] res = new int[a.length];
    Arrays.fill(res, -1);
    Deque<Integer> st = new ArrayDeque<>();           // indices whose answer is still unknown
    for (int i = 0; i < a.length; i++) {
        while (!st.isEmpty() && a[st.peek()] < a[i]) res[st.pop()] = a[i];
        st.push(i);
    }
    return res;
}

// 4. Sliding window maximum (monotonic deque), O(n)
int[] maxSlidingWindow(int[] nums, int k) {
    int[] res = new int[nums.length - k + 1];
    Deque<Integer> idx = new ArrayDeque<>();          // indices, values decreasing
    for (int i = 0; i < nums.length; i++) {
        if (!idx.isEmpty() && idx.peekFirst() <= i - k) idx.pollFirst();       // out of window
        while (!idx.isEmpty() && nums[idx.peekLast()] <= nums[i]) idx.pollLast(); // drop smaller
        idx.offerLast(i);
        if (i >= k - 1) res[i - k + 1] = nums[idx.peekFirst()];
    }
    return res;
}
```

0-1 BFS uses both ends: `offerFirst` for an edge of weight 0, `offerLast` for weight 1.

## Use in DSA

Every stack problem (valid parentheses, monotonic stack, iterative DFS), every queue (BFS, topological sort), 0-1 BFS, sliding window max/min.

## Pitfalls

- **Iteration order**: iterating an `ArrayDeque` used as a stack goes **top to bottom**. Iterating a `Stack` goes bottom to top.
- **`ArrayDeque` rejects `null`** (`push(null)` throws an NPE).
- **`pop()` / `remove()` on empty** throw. `poll()` / `peek()` return `null`, and unboxing that `null` into an `int` throws an NPE.
- **`dq.contains(x)` / `dq.remove(Object)`** are O(n).
- For a primitive-heavy stack in tight loops, a plain `int[] st = new int[n]; int top = 0;` beats any collection (no boxing).

**Next:** [5. Utilities, List.of & Conversions](/notes/coll-utilities)
