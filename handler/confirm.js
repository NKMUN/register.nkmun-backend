'use strict'

module.exports = {
    Post: function* Handler_Post_Confirm() {
        const {r, mock} = this
        const {school} = this.token

        if (!mock) {
            const {state} = yield r.table('enroll').get(school).pluck('state')

            if (state !== 'representative-info') {
                this.status = 400
                this.body = { state: false, message: 'Invalid state to confirm' }
                return
            }

            yield r.table('enroll').get(school).update({ state: 'confirmed' })
        }

        this.status = 200
        this.body = { status: true }
    }
}
