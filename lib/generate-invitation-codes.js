const Random = new (require('random-js'))()
const {encode: base62_encode} = require('base62')

const RNG_MIN = Math.pow(62,5)
const RNG_MAX = Math.pow(62, 6) - 1

function generateUniqueRandoms(num) {
    let s = new Set()
    for (let i=0; i!==num; ++i) {
        let num = Random.integer(0, 0xFFFFFFFF)
        if (!s.has(num))
            s.add(num)
        else
            --i
    }
    return [...s].map( base62_encode )
}

module.exports = generateUniqueRandoms