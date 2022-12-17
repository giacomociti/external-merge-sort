# External Merge Sort
Implementation of [external merge sort](https://en.wikipedia.org/wiki/External_sorting) based on async generators.
The `sort` function takes an iterable and returns an async generator yielding the input values sorted.
It relies on a `merge` function which can also be useful on its own, in case you want to merge two or more iterables already sorted.

## Usage

```js
import { sort } from 'external-merge-sort'

const sorted = sort([3,1,2])

for await (const item of sorted) {
  console.log(item)
}
```

the simple usage above is not that useful in practice: the iterable input normally comes from a big file stream and you need to provide additional options to specify:

- *maxSize*:
    the size of chunks in which to split the input
- *maxFiles*:
    threshold for the additional pass (usually not needed)
- *comparer*:
    a custom comparison function
- *store*:
    an object capable to `write` chunks to temporary storage, returning an iterable over stored items

See [txt.js](./examples/txt.js) and [rdf.js](./examples/rdf.js) for two examples.



