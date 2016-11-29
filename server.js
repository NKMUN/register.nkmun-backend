'use strict'

const Router = require('koa-router')
const {get, post} = require('koa-router')
const {resolve} = require('path')
const {createServer} = require('http')
const winston = require('winston')
const {info, warn, error} = require('winston')
const {red, blue, green} = require('chalk')
const accesslog = require('koa-accesslog')
const koaBody = require('koa-body')
const devNull = require('dev-null')
const Mailer = require('nodemailer')

const Handler = require('./handler')

function createDBConnection(dbHost, dbPort) {
    return require('rethinkdbdash')({
        host:   dbHost,
        port:   dbPort,
        db:     'nkmun',
        pool:   true,
        max:    5,
        cursor: false
    })
}

function createApp({
    mock,
    accessLog,
    dbHost='127.0.0.1',
    dbPort=28015,
    secret='secret',
    mailer,
    smtpAccount,
    smtpNick
}) {
    const app = require('koa')()

    app.context.JWT_SECRET = secret
    app.context.NOTICE_MAIL_FROM = smtpNick ? `"${smtpNick}" <${smtpAccount}>` : smtpAccount
    app.context.mailer = mailer
    app.context.mock = mock
    if (mock)
        warn(red('Running in mock mode'))
    if (!mock)
        app.context.r = createDBConnection(dbHost, dbPort)
    app.on('error', function(err) {
        error(err.message)
        error(err.stack)
        if ( err.message.indexOf('REQLDriver') ) {
            // reset db connection
            app.context.r = createDBConnection(dbHost, dbPort)
        }
    })

    app.use( accesslog(accessLog) )
    app.use( koaBody({ multipart: true }) )

    // Public Router
    let publics = new Router()
    publics.post('/enroll', Handler.Enroll.Post )
    publics.get( '/enroll', Handler.Enroll.Get )
    publics.get( '/login',  Handler.Login.Router, Handler.Login.Get )
    publics.post('/login',  Handler.Login.Post )
    publics.get( '/disclaimer', Handler.Disclaimer.Get)
    publics.get( '/invitation/:invitation', Handler.Invitation.Get)
    publics.post('/leader', Handler.Leader.Post)

    // Leader Router
    let leaders = new Router()
    let HasLeaderAccess = Handler.Login.HasAccess('leader')
    leaders.get(   '/leader', HasLeaderAccess, Handler.Leader.Get )
    leaders.get(   '/leader/exchange-request',      HasLeaderAccess, Handler.Leader.GetExchangeRequest )
    leaders.post(  '/leader/exchange-request',      HasLeaderAccess, Handler.Leader.PostExchangeRequest )
    leaders.post(  '/leader/exchange-request/:xid', HasLeaderAccess, Handler.Leader.FetchExchangeRequest, Handler.Leader.AcceptExchangeRequest )
    leaders.delete('/leader/exchange-request/:xid', HasLeaderAccess, Handler.Leader.FetchExchangeRequest, Handler.Leader.RefuseExchangeRequest )
    leaders.post(  '/leader/giveup/:committee',     HasLeaderAccess, Handler.Leader.GiveupQuota )
    leaders.post(  '/leader/confirm-quota',         HasLeaderAccess, Handler.Leader.ConfirmQuota )
    leaders.get(   '/accommodation',                HasLeaderAccess, Handler.Accommodation.Get )
    leaders.post(  '/accommodation',                HasLeaderAccess, Handler.Accommodation.Post )
    leaders.get(   '/leader/billing',               HasLeaderAccess, Handler.Payment.Get )
    leaders.post(  '/payment',                      HasLeaderAccess, Handler.Payment.Post )
    // Leader Stage-2
    leaders.post(  '/accommodation2',               HasLeaderAccess, Handler.Accommodation2.Post )
    leaders.get(   '/leader/billing2',              HasLeaderAccess, Handler.Payment2.Get )
    leaders.post(  '/payment2',                     HasLeaderAccess, Handler.Payment2.Post )
    // Pre Conference
    leaders.get(   '/representative',      HasLeaderAccess, Handler.Representative.Get )
    leaders.get(   '/representative/:id',  HasLeaderAccess, Handler.Representative.GetId )
    leaders.post(  '/representative/:id',  HasLeaderAccess, Handler.Representative.PostId )

    // Admin Router
    let admins = new Router()
    let HasAdminAccess = Handler.Login.HasAccess('admin')
    admins.get( '/enroll',        HasAdminAccess, Handler.Enroll.Get )
    admins.get( '/enroll/:id',    HasAdminAccess, Handler.Enroll.GetId )
    admins.post('/enroll/:id',    HasAdminAccess, Handler.Enroll.PostId )
    admins.get( '/enroll/status', HasAdminAccess, Handler.Enroll.GetStatus )
    admins.get( '/enroll/committee/:id', HasAdminAccess, Handler.Enroll.GetCommittee )
    admins.post('/action',        HasAdminAccess, Handler.Action.Post )
    admins.post('/invitation',    HasAdminAccess, Handler.Invitation.Post )
    admins.post('/pending',       HasAdminAccess, Handler.Pending.Post )
    admins.get( '/billing/:id',   HasAdminAccess, Handler.Payment.GetId )
    admins.get( '/accommodation/:id', HasAdminAccess, Handler.Accommodation.GetReservation )
    admins.get( '/payment',       HasAdminAccess, Handler.Payment.GetList )
    admins.get( '/payment/:id',   HasAdminAccess, Handler.Payment.GetPaymentCredential )
    admins.post('/payment/:id',   HasAdminAccess, Handler.Payment.PostReview )
    // Admin Stage-2
    admins.post('/stage2',        HasAdminAccess, Handler.Invitation.PostStage2 )
    admins.get( '/billing2/:id',  HasAdminAccess, Handler.Payment2.GetId )
    admins.get( '/payment2',      HasAdminAccess, Handler.Payment2.GetList )
    admins.get( '/payment2/:id',  HasAdminAccess, Handler.Payment2.GetPaymentCredential )
    admins.post('/payment2/:id',  HasAdminAccess, Handler.Payment2.PostReview )
    admins.get( '/accommodation2/:id', HasAdminAccess, Handler.Accommodation2.GetReservation )
    // Pre Conference
    admins.post('/representative', HasAdminAccess, Handler.Representative.Post )

    app.use( publics.routes() )
    app.use( Handler.Login.Router )
    app.use( leaders.routes() )
    app.use( admins.routes() )

    return app
}

module.exports = {
    create({ mock = false, port = 8001, host, accessLog, log,
             dbHost, dbPort,
             secret,
             smtpAccount, smtpNick, smtpPassword, smtpHost, smtpPort=465
    }) {
        winston.add( winston.transports.File, {
            colorize: log === process.stdout,
            json:     false,
            stream:   log ? log : devNull()
        })
        winston.remove( winston.transports.Console )

        let mailer
        if (smtpAccount && smtpPassword && smtpHost) {
            mailer = Mailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: true,
                pool: true,
                auth: {
                    user: smtpAccount,
                    pass: smtpPassword
                }
            })
        }

        let app = createApp({
            accessLog: accessLog ? accessLog: devNull(),
            mock,
            dbHost,
            dbPort,
            secret,
            mailer,
            smtpAccount,
            smtpNick
        })

        let server = createServer( app.callback() )
                     .listen(port, host, ()=>{
                         let {address, port, family} = server.address()
                         if (family === 'IPv6')
                             address = `[${address}]`
                         info(`Server listening on: ${blue(`${address}:${port}`)}`)
                     })

        return server
    }
}
