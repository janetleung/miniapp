const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('app.sqlite')

const dbInit = () => {
  db.serialize(function() {
    db.run("create table activities_info(id integer, participants varchar, title varchar, time varchar, location varchar, desc text, address varchar, address_detail varchar, created_by integer, created_at integer, updated_at integer)");
    db.run("create table activities_token (id INTEGER PRIMARY KEY, token varchar, openid varchar)")
    db.run("create table activities_user (id INTEGER PRIMARY KEY, nickname varchar, gender INTEGER, avatar text, language varchar, openid varchar, created_at INTEGER, updated_at INTEGER)")
    // db.all("select * from activities_info", (err, res) => {
    //   console.log(err, res)
    // })
    // db.run("insert into activities_info values(1,'40302063','test','2018-01-01T00:00:00.000000+08:00', '{\"coordinates\"\:[113.32455405812205\,23.10645918477737]\,\"type\"\:\"Point\"}','testtest','广州塔','阅江西路222号','40368608',1514466660,1514466661)")
    // db.run("insert into activities_token (token, openid, varchar) values ('token', 'openid', 'test')")
    // db.run('drop table activities_user')
  })
  db.close()
}

// dbInit()

const queryList = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from activities_info where participants like '%${userId}%'`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const queryActivity = (id) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from activities_info where id = '${id}'`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const updateActivity = (id, data) => {
  if (!id) return
  return new Promise((resolve, reject) => {
    data = {...data, updated_at: now()}
    let str = Object.keys(data).map(i => {
      let value = handleData(data[i])
      return `${i} = '${value}'`
    })
    str = str.join(', ')
    db.run(`update activities_info set ${str} where id = ${id}`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject(err)
      }
    })
  })
}

const createActivity = (data) => {
  return new Promise((resolve, reject) => {
    data = {...data, created_at: now(), updated_at: now()}
    let keys = Object.keys(data).join(', ')
    let values = Object.values(data).map(val => `'${handleData(val)}'`).join(', ')
    db.all(`insert into activities_info (${keys}) values (${values})`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const createUser = (data) => {
  return new Promise((resolve, reject) => {
    data = {...data, created_at: now(), updated_at: now()}
    let keys = Object.keys(data).join(', ')
    let values = Object.values(data).map(val => `'${handleData(val)}'`).join(', ')
    db.all(`insert into activities_user (${keys}) values (${values})`, (err, res) => {
      if (!err) {
        db.run(`select * from activities_user where openid = '${data.openid}'`, (err, res) => {
          if (!err) {
            resolve(res)
          }
        })
      } else {
        reject('error')
      }
    })
  })
}

const getUser = (id) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from activities_user where openid = '${id}'`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const createToken = (token, openid) => {
  return new Promise((resolve, reject) => {
    db.all(`insert into activities_token (token, openid) values ('${token}', '${openid}')`, (err, res) => {
      if (!err) {
        resolve('success')
      } else {
        reject('error')
      }
    })
  })
}

const getToken = (id) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from activities_token where openid = '${id}'`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const getInfo = (table, data) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from activities_${table} where ${data[0]} = '${data[1]}'`, (err, res) => {
      if (!err) {
        resolve(res)
      } else {
        reject('error')
      }
    })
  })
}

const handleData = (data) => {
  if (Array.isArray(data)) {
    return data.toString().replace('[', '').replace(']', '')
  } else if (typeof data === 'object') {
    return JSON.stringify(data)
  } else {
    return data.toString()
  }
}

const now = () => parseInt(new Date().getTime() / 1000)

let methods = {
  dbInit,
  queryList,
  queryActivity,
  updateActivity,
  createActivity,
  getUser,
  createUser,
  createToken,
  getToken,
  getInfo
}

export default methods
