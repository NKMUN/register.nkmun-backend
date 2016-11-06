'use strict'

module.exports = function createInvitationMail({school, reason}) {
return `
<div style="width: 500px">
  <div style="width: 100%">
    <img src="http://odhxwvue8.bkt.clouddn.com/header.png" style="width: 100%;"/>
  </div>
  <div>
    <h3 style="text-align: center;">2017汇文国际中学生模拟联合国大会缴费审核结果</h3>
    <p>尊敬的${school}领队：</p>
    <p>您好，</p>
    <p style="text-indent: 2em;">经过财务部核实，我们已经收到贵校的汇来的费用。但是由于${reason}，遗憾的通知您，贵校一轮缴费尚未成功，请您尽快联系组委完成一轮缴费，以确保贵校一轮名额分配获得的席位不被回收。如有任何问题，请您及时通过联系我们。谢谢您对组委工作的支持与配合！<br>
    <p>顺颂秋祺</p>
    <p style="text-align: right">
      2017汇文国际中学生模拟联合国大会<br>
      组织委员会
    </p>
  </div>
</div>
`
}
