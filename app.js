import Koa from 'koa2'
import koaRouter from 'koa-router'
import bodyParser from 'koa-bodyparser'
import methods from './sqlite.js'
import config from './config.js'
import koaRequest from 'koa-http-request'
import crypto from 'crypto'
import WXBizDataCrypt from './WXBizDataCrypt'

const router = koaRouter()
const app = new Koa()

app.use(async (ctx, next) => {
  console.log(`Process ${ctx.request.method} ${ctx.request.url}...`);
  await next();
})


app.use(async (ctx, next) => {
  if (ctx.path === '/login/') {
    await next()
  } else {
    let token = ctx.request.headers[config.SESSION_KEY] || ''

    if (!token) {
      ctx.status = 401
      ctx.response.body = '请重新登录'
    } else {
      let data = await methods.getInfo('token', ['token', token])
      ctx.openid = data[0].openid
      await next()
    }
  }
})

app.use(koaRequest({
  json: true,
  timeout: 3000,
  host: 'https://api.weixin.qq.com'
}))

app.use(bodyParser())

router.get('/userInfo/', async (ctx, next) => {
  let uid = ctx.request.query.id
  let res = await methods.getUser(uid)
  ctx.response.body = res
})

router.post('/userInfo/', async (ctx, next) => {
  let data = ctx.request.body
  let userData = await methods.getUser(ctx.session.uid)
  if (!userData) {
    await methods.createUser({...data, uid: ctx.session.uid, unionid: ctx.session.unionid})
    ctx.response.body = 'success'
  } else {
    ctx.response.body = 'already exists'
  }
})

router.get('/login/', async (ctx, next) => {
  let {code, encryptedData, iv, rawData, signature} = ctx.request.query

  let weixinData = await ctx.get(`/sns/jscode2session?appid=${config.appid}&secret=${config.appSecret}&js_code=${code}&grant_type=authorization_code`,)
  if (!!weixinData.errcode) {
    ctx.status = 401
    ctx.response.body = '登录出错请重试'
  } else {
    let sessionKey = weixinData.session_key
    let openid = weixinData.openid

    let pc = new WXBizDataCrypt(config.appid, sessionKey)
    let data = pc.decryptData(encryptedData , iv)
    let findToken = await methods.getToken(openid)
    if (!!findToken.length) {
      ctx.set(config.SESSION_KEY, findToken[0].token)
      let res = await methods.getUser(data.openId)
      let {openid, ...rest} = res[0]
      ctx.response.body = rest
    } else {
      let token = await createMd5(openid)
      let userData = {
        openid: data.openId,
        nickname: data.nickName,
        avatar: data.avatarUrl,
        gender: data.gender,
        language: data.gender
      }
      let userInfo = await methods.createUser(userData)
      ctx.set(config.SESSION_KEY, token)
      let {openid, ...rest} = userInfo
      ctx.response.body = rest
    }
  }
})

const createMd5 = async (openid) => {
  let buf = crypto.randomBytes(8)
  let content = `${buf.toString('hex')}${config.md5Serect}`
  let md5 = crypto.createHash('md5')

  let token = md5.update(content).digest('hex')
  let res = await methods.createToken(token, openid)
  return !!res ? token : ''
}

router.get('/list/', async (ctx, next) => {
  let userId = ctx.request.query.id
  let res = await methods.queryList(userId)
  ctx.response.body = res
})

router.get('/activity/:id/', async (ctx, next) => {
  let activityId = ctx.params.id
  let res = await methods.queryActivity(activityId)
  ctx.response.body = res
})

router.put('/activity/:id/', async (ctx, next) => {
  let activityId = ctx.params.id
  let data = ctx.request.body
  let res = await methods.updateActivity(activityId, data)
  ctx.response.body = 'success'
})

router.post('/activity/', async (ctx, next) => {
  let data = ctx.request.body
  let res = await methods.createActivity(data)
  ctx.response.body = res
})

app.use(router.routes())

app.listen(3000)
console.log('app started at port 3000...')
