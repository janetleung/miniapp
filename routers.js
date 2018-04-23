import koaRouter from 'koa-router'
import config from './config.js'
import methods from './sqlite.js'
import crypto from 'crypto'
import WXBizDataCrypt from './WXBizDataCrypt'

const router = koaRouter()

const hasResult = (obj) => {
  if (Array.isArray(obj)) {
    return !!obj.length
  } else {
    return !(obj instanceof Error)
  }
}

router.get('/login/', async (ctx, next) => {
  let {token, uid} = ctx

  if (token) {
    // token 正确
    let userInfo = await methods.queryData('user', 'id', ctx.uid)
    if (!!userInfo && !(userInfo instanceof Error)) {
      // 成功读取用户信息并返回
      delete userInfo.openid
      ctx.response.body = userInfo
    } else {
      // 获取用户信息出错
      ctx.status = 400
      ctx.response.body = '服务器出错，请稍后重试'
    }
  } else {
    // token 不正确或无
    let {code, encryptedData, iv} = ctx.request.query// 1.获取微信返回的数据

    // 这里发请求用了 koa-http-request，初始化后可以直接通过 ctx.get 发送请求
    let weixinData = await ctx.get('/sns/jscode2session', {
      appid: config.appid,
      secret: config.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    })// 2.向微信服务器请求 openid 和 session_key

    // 3.生成后端服务的 session
    let sessionKey = weixinData.session_key
    let openid = weixinData.openid

    let pc = new WXBizDataCrypt(config.appid, sessionKey)// 需引入微信提供的解密方法
    let data = pc.decryptData(encryptedData , iv)// 解密微信返回的数据

    let now = new Date().getTime()
    let userData = {
      openid: data.openId,
      nickname: data.nickName,
      avatar: data.avatarUrl,
      gender: data.gender,
      language: data.language,
    }

    let dbUserInfo = await methods.queryData('user', 'openid', userData.openid)
    let dbTokenInfo = await methods.queryData('user_token', 'openid', userData.openid)

    if (hasResult(dbUserInfo) && hasResult(dbTokenInfo)) {
      // 已登录过的用户
      let tokenInfo = await methods.updateData('user_token', {
        expired_time: now + config.maxAge
      }, {
        openid: userData.openid
      })

      delete dbUserInfo.openid
      ctx.set(config.SESSION_KEY, tokenInfo.token)
      ctx.response.body = dbUserInfo
    } else {
      let userInfo = null
      if (hasResult(dbUserInfo)) {
        userInfo = await methods.updateData('user', userData, {
          id: dbUserInfo.id
        })// 更新用户信息
      } else {
        userInfo = await methods.createData('user', userData)// 存储用户信息
      }

      let token = await createMd5(openid + config.serect)// 创建用户唯一 token， serect 为某一特定字段
      let tokenObj = {
        token,
        session_key: sessionKey,
        openid,
        user_id: userInfo.id,
        expired_time: now + config.maxAge,// 计算过期时间
      }

      if (hasResult(dbTokenInfo)) {
        await methods.updateData('user_token', tokenObj, {
          id: dbTokenInfo.id
        })
      } else {
        await methods.createData('user_token', tokenObj)
      }

      ctx.set(config.SESSION_KEY, token)// 将 token 设置到 request 头部
      delete userInfo.openid// openid 不允许发送到客户端
      ctx.response.body = userInfo
    }
  }
})

const createMd5 = async (openid) => {
  let buf = crypto.randomBytes(8)
  let content = `${buf.toString('hex')}${config.md5Serect}`
  let md5 = crypto.createHash('md5')

  let token = md5.update(content).digest('hex')
  return token
}

// 获取某用户参与的所有活动
router.get('/activities/', async (ctx, next) => {
  let userId = ctx.request.query.id
  let activityIds = await methods.queryData('activities_record', 'created_by', userId, 'activity_id')

  if (hasResult(activityIds)) {
    activityIds = Array.isArray(activityIds) ? activityIds.map(a => a.activity_id) : activityIds.activity_id
    let activities = await methods.queryData('activities_info', 'id', activityIds)
    activities = Array.isArray(activities) ? activities : [activities]
    activities.forEach(a => {
      let geoJson = JSON.parse(a.location).geoJSON
      a.location = geoJson
    })
    ctx.response.body = activities
  } else {
    ctx.response.body = []
  }
})

// 获取某一活动的详细信息
router.get('/activity/:id/', async (ctx, next) => {
  let activityId = ctx.params.id
  let res = await methods.queryData('activities_record', 'id', activityId)
  ctx.response.body = res
})

// 修改某一活动信息
router.put('/activity/:id/', async (ctx, next) => {
  let activityId = ctx.params.id
  let data = ctx.request.body
  let res = await methods.updateData('activities_record', data, {
    id: activityId
  })
  ctx.response.body = res
})

// 创建新活动
router.post('/activity/', async (ctx, next) => {
  let data = ctx.request.body
  data.location = JSON.stringify(data.location)
  data.created_by = ctx.uid
  let res = await methods.createData('activities_info', data)
  let newActivityrecord = await methods.createData('activities_record', {
    activity_id: res.id,
    created_by: ctx.uid
  })
  ctx.response.body = res
})

export default router
