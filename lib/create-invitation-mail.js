'use strict'

module.exports = function createInvitationMail({school, name, code}) {
return `
<div style="width: 500px">
  <div style="width: 100%">
    <img src="http://odhxwvue8.bkt.clouddn.com/header.png" style="width: 100%;"/>
  </div>
  <div>
    <h3 style="text-align: center;">2017汇文国际中学生模拟联合国大会名额分配结果</h3>
    <p>尊敬的${school}领队：</p>
    <p>您好，</p>
    <p style="text-indent: 2em;">很荣幸地通知您，您所代表的学校通过了2017汇文国际中学生模拟联合国大会学术测试。<br>
    <p style="text-indent: 2em;">本届大会使用自主开发的Hi汇文报名系统进行会议注册，您注册时的邀请码为:</p>
    <span style="text-align: center; margin: auto; font-size: 24px; color: #2196f3; display: block;">${code}</span>
    <p style="text-indent: 2em;">请尽快访问
      <a href="http://hi.nkmun.cn" style="text-decoration: none; color: #2196f3">http://hi.nkmun.cn</a> 完成领队注册，并查看名额分配情况，详情请阅读第三轮通告，非常感谢您的配合与支持！</p>
    <p style="text-indent: 2em;">完成领队注册后，请学生领队尽早加入NKMUN2017领队群，QQ群号为：428679776，申请加群时请在备注中填写学校和领队姓名。</p>
    <p>顺颂秋祺</p>
    <p style="text-align: right">
      2017汇文国际中学生模拟联合国大会<br>
      组织委员会
    </p>
  </div>
</div>
`
}
