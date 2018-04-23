import Koa from 'koa2'
import bodyParser from 'koa-bodyparser'
import config from './config.js'
import koaRequest from 'koa-http-request'
import router from './routers.js'
import methods from './sqlite.js'

const app = new Koa()

app.use(async (ctx, next) => {
  console.log(`Process ${ctx.request.method} ${ctx.request.url}...`)
  await next()
})

// 处理 token
app.use(async (ctx, next) => {
  let headerToken = ctx.request.header[config.SESSION_KEY]

  if (!!headerToken) {
    let tokenInfo = await methods.queryData('user_token', 'token', headerToken)
    if (!!tokenInfo && !(tokenInfo instanceof Error)) {
      let now = new Date().getTime()
      let expired = now - tokenInfo.expired_time > 0
      ctx.token = headerToken
      if (!expired || ctx.path === '/login/') {
        methods.updateData('user_token', {
          expired_time: now + config.maxAge
        }, {
          token: headerToken
        })
        ctx.uid = tokenInfo.user_id
      }
    } else {
      ctx.set(config.SESSION_KEY, '')
    }
  }
  await next()
})

app.use(async (ctx, next) => {
  if (ctx.path === '/login/') {
    await next()
  } else if (!ctx.token || !ctx.uid) {
    ctx.status = 401
    ctx.response.body = '请登录'
  } else {
    await next()
  }
})

app.use(koaRequest({
  json: true,
  timeout: 3000,
  host: 'https://api.weixin.qq.com'
}))

app.use(bodyParser())

app.use(router.routes())

app.listen(3000)
console.log('app started at port 3000...')
