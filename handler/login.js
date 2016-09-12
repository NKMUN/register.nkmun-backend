'use strict'

const {sign, verify, decode} = require('jsonwebtoken')

const AUTHORIZATION_PREFIX = 'Bearer '
const MOCK_ADMIN_CRED = require('../mock-data')
const JWT_OPTS = { expiresIn: '7d' }

module.exports = {
    Get: function* Get_Login() {
        // use with Router_Login
        // refresh token's issue time
        const {r, mock, request, JWT_SECRET, token} = this
        let cred
        if (token)
            cred = {
                id:     token.id,
                access: token.access
            }

        let newToken = sign(cred, this.JWT_SECRET)

        this.status = 200
        this.body   = { status: true, token: newToken, cred }
    },
    Post: function* Post_Login() {
        // check username / password
        const {r, mock, request, JWT_SECRET} = this
        let {user, password} = this.is('multipart') ? request.body.fields : request.body

        let success = mock 
                    ? (user==='ok' ? true : false)
                    : yield r.table('user').get(user).default({})('password').eq(password)

        if (!success) {
            this.status = 403
            this.body   = { status: false, message: 'Invalid username / password' }
            return
        }

        let cred = mock 
                 ? MOCK_CRED
                 : yield r.table('user').get(user).pluck('id', 'access')
        
        let token = sign(cred, JWT_SECRET)

        this.status = 200
        this.body   = { status: true, token, cred }
    },
    Router: function* Router_Login(next) {
        // check if token is valid, return 401 if not
        let tokenStr, authorization = this.request.get('Authorization') || ''
        if (authorization.startsWith(AUTHORIZATION_PREFIX)) 
            tokenStr = authorization.slice(AUTHORIZATION_PREFIX.length)

        if (!tokenStr) {
            this.status = 401
            this.body   = { status: false, message: 'No token' }
            this.set('WWW-Authenticate', 'Bearer token_type="JWT"')
            return
        }

        try {
            this.token = verify(tokenStr, this.JWT_SECRET)
            if (!this.token)
                throw new Error('Token invalid or expired')
            
        }catch(e){
            this.status = 401
            this.body   = { status: false, message: e.message }
            this.set('WWW-Authenticate', 'Bearer token_type="JWT"')
            return
        }

        yield next
    },
    HasAccess(accessStr) {
        return function* HasAccess_Login(next) {
            let tokenAccessStr = this.token ? this.token.access || '' : '' 
            if (!tokenAccessStr.includes(accessStr)) {
                this.status = 403
                this.body   = { status: false, message: 'Access denied'}
                return
            }
            yield next
        }
    }
}