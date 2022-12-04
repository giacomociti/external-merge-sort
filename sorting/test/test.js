import { sort } from '../sorting.js'

const result = sort([1,3,2])
for await (const item of result) {
    console.log(item)
}