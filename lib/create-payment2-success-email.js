'use strict'

module.exports = function createInvitationMail({school, money}) {
return `
<div style="width: 500px">
  <div style="width: 100%">
    <img src="http://odhxwvue8.bkt.clouddn.com/header.png" style="width: 100%;"/>
  </div>
  <div>
    <h3 style="text-align: center;">2017汇文国际中学生模拟联合国大会缴费审核结果</h3>
    <p>尊敬的${school}领队：</p>
    <p>您好，</p>
    <p style="text-indent: 2em;">经过财务部核实，我们已经收到贵校的全部会费与住宿费，共计${money}元整。在此通知您，贵校二轮缴费成功，谢谢您对组委工作的支持与配合！<br>
    <p>顺颂秋祺</p>
    <p style="text-align: right">
      2017汇文国际中学生模拟联合国大会<br>
      组织委员会
    </p>
  </div>
</div>
`
}
