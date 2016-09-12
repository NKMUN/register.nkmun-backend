'use strict'

const {randomBytes} = require('crypto')

let secret

module.exports = {
    Post: function*() {
        let {r, mock} = this.context

        if (!secret) {
            secret = randomBytes(16).toString('hex')
            this.status = 202
            this.body = { status: true, secret: secret, message: 'post with secret to reset database' }
            return
        }

        if (secret !== this.body.secret ) {
            secret = null
            this.status = 403
            this.body = { status: false, message: 'incorrect secret' }
            return
        }

        if (secret === this.body.secret) {
            if (!mock) {
                // reset database
            }
            this.status = 202
            this.body = { status: true, message: 'database initialized' }
            return
        }
    }
}