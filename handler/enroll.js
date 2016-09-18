'use strict'

const {MOCK_ENROLL_ENTRY, MOCK_ENROLL_LIST} = require('../mock-data')

module.exports = {
    Post: function* POST_Enroll() {
        const {r, mock, request} = this
        let data = this.is('multipart') ? request.body.fields : request.body

        data.submission_time = mock
                            ? (new Date()).getTime() / 1000
                            : r.now().toEpochTime()
        if (data.school)
            data.id = data.school

        let {inserted} = mock
                    ? ( data.school==='duplicate' ? {inserted:0} : {inserted:1} )
                    : yield r.table('enroll').insert(data)

        if (inserted) {
            this.status = 202
            this.body = { status: true, message: 'enrollment request submitted' }
        }else{
            this.status = 409
            this.body = { status: false, message: 'duplicate enrollment record' }
        }
    },
    PostId: function* POST_Enroll_Id() {
        const {r, mock, request} = this
        let data = this.is('multipart') ? request.body.fields : request.body

        let {replaced} = mock
                       ? {replaced: 1}
                       : yield r.table('enroll').get(this.params.id).update(data)
        
        if (replaced) {
            this.status = 202
            this.body   = { status: true, message: 'updated' }
        }else{
            this.status = 404
            this.body   = { status: false, message: 'entry does not exist' }
        }

    },
    Get: function* Get_Enroll() {
        const {r, mock} = this
        const {id} = this.params
        const {committee} = this.query
        const fields = ['id', 'school', 'quote', ... (committee ? ['committee'] : []) ]
        this.status = 200
        this.body   = mock
                    ? MOCK_ENROLL_LIST
                    : yield r.table('enroll')
                            .orderBy({index: r.desc('submission_time')})
                            .pluck( ...fields )
    },
    GetId: function* Get_Enroll_Id() {
        const {r, mock} = this
        const {id} = this.params
        let entry = mock
                  ? MOCK_ENROLL_ENTRY
                  : yield r.table('enroll').get(id)
        this.status = entry ? 200 : 404
        this.body   = entry
    }
}
