'use strict'

module.exports = function MailerSendMail(mailer, opts) {
    return new Promise( (resolve, reject) => {
        mailer.sendMail(opts, (err, info)=>{
            if (err)
                reject(err)
            else
                resolve(info)
        })
    })
}
