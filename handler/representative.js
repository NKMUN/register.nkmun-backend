'use strict'

const csvStringify = require('csv-stringify')

const unique = (a) => [ ... new Set(a) ]
const keys = Object.keys

function merge(c1 = {}, c2 = {}) {
    let ret = {}
    unique([ ...keys(c1), ...keys(c2) ])
    .forEach( key => {
        let q1 = Number(c1[key]) || 0
        let q2 = Number(c2[key]) || 0
        ret[key] = q1+q2
    })
    return ret
}

module.exports = {
    Post: function* POST_Representative() {
        const {r, mock} = this
        const {school} = this.is('multipart') ? this.request.body.fields : this.request.body

        if (mock) {
            this.status = 200
            this.body = { status: true }
            return
        }

        let {committee: C1, committee2: C2} = yield r.table('enroll').get(school).pluck('committee', 'committee2')
        let committee = merge(C1, C2)
        let entries = []

        for (let k in committee) {
            let {replaced} = yield r.table('representative').getAll(k, {index: 'committee'})
                                   .filter( r.row('school').default(null).not() )
                                   .limit(committee[k]).update({ school })
            if (replaced !== committee[k]) {
                this.status = 500
                this.body = { status: null, message: 'Fail to allocate from representative pool, fix database manually!' }
                return
            }
        }

        yield r.table('enroll').get(school).update({ state: 'representative-info' })

        this.status = 200
        this.body = { status: true }
    },
    Get: function* GET_Representative() {
        const {r, mock} = this
        const {school: schoolId} = this.token

        this.status = 200
        this.body = yield r.table('representative').getAll(schoolId, {index: 'school'})
    },
    GetId: function* GET_Representative_Id() {
        const {r, mock} = this
        const {school: schoolId} = this.token
        const id = this.params.id

        if (mock) {
            this.status = 200
            this.body = { }
            return
        }

        let rep = yield r.table('representative').get(id)

        if (rep.school !== schoolId) {
            this.status = 404
            this.body = null
        } else {
            this.status = 200
            this.body = rep
        }
    },
    PostId: function* POST_Representative_Id() {
        const {r, mock} = this
        const {school: schoolId} = this.token
        const id = this.params.id
        const payload = this.is('multipart') ? this.request.body.fields : this.request.body

        if (mock) {
            this.status = 200
            this.body = { }
            return
        }

        let {school: repSchool} = yield r.table('representative').get(id).pluck('school')

        if (repSchool !== schoolId) {
            this.status = 404
            this.body = { status: false, message: 'representative does not exist' }
        } else {
            delete payload.school
            delete payload.id
            delete payload.committee
            yield r.table('representative').get(id).update(payload)
            this.status = 200
            this.body = { status: true }
        }
    },
    DumpAll: function* GET_Representative_DumpAll() {
        const {r, mock} = this

        if (mock) {
            this.status = 200
            this.body = []
        } else {
            this.status = 200
            this.body = yield r.table('representative').filter( r.row('school') )
        }
    }
}
