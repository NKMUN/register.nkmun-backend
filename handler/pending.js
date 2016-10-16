'use strict'

module.exports = {
    Post: function* Handler_Post_Pending() {
        const {mock, r} = this
        const {id} = this.request.body

        let {
            school,
            state
        } = mock
          ? {school: id}
          : yield r.table('enroll').get(id).default({}).pluck('school', 'state')

        if (!school) {
            this.status = 404
            this.body   = { status: false, message: 'School does not exist' }
            return
        }

        if (!state || state === 'pending') {
            let {replaced} = mock
                           ? { replaced: 1 }
                           : yield r.table('enroll').get(id).update({ state: 'pending' })

            this.status = replaced ? 200 : 500
            this.body   = replaced ? { status: true } : { status: false, message: 'Fail to update state' }
            return
        }

        this.status = 400
        this.body   = { status: false, message: `Can not change state '${state}' to 'pending'`, state }
    }
}