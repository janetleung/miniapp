const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('app.sqlite')

const dbInit = () => {
  db.serialize(function() {

    let createTable = function(table, fields) {
      fields = fields.map(f => {
        return `${f.name} ${f.type || 'varchar'}`
      }).join(', ')
      db.run(`create table ${table}(id integer PRIMARY KEY AUTOINCREMENT, created_at datetime, updated_at datetime, ${fields})`)
    }

    let tables = [
      {
        table: 'activities_info',
        fields: [{
          name: 'title'
        }, {
          name: 'time',
          type: 'datetime'
        }, {
          name: 'location'
        }, {
          name: 'desc'
        }, {
          name: 'address'
        }, {
          name: 'address_detail'
        }, {
          name: 'created_by',
          type: 'integer'
        }]
      }, {
        table: 'activities_record',
        fields: [{
          name: 'activity_id',
          type: 'integer'
        }, {
          name: 'created_by',
          type: 'created_by'
        }]
      }, {
        table: 'user',
        fields: [{
          name: 'nickname'
        }, {
          name: 'gender',
          type: 'integer'
        }, {
          name: 'avatar',
          type: 'text'
        }, {
          name: 'language'
        }, {
          name: 'openid'
        }]
      }, {
        table: 'user_token',
        fields: [{
          name: 'token'
        }, {
          name: 'session_key'
        }, {
          name: 'openid'
        }, {
          name: 'user_id',
          type: 'integer'
        }, {
          name: 'expired_time',
          type: 'datetime'
        }]
      }
    ]

    for(let table of tables) {
      createTable(table.table, table.fields)
    }
  })
  db.close()
}

const now = () => parseInt(new Date().getTime() / 1000)

const queryData = (table, key, value, select = '*') => {
  let valueIsArray = Array.isArray(value)
  let placehloder = valueIsArray ? value.map(v => '?') : '?'
  let query = valueIsArray ? `in (${placehloder})` : `= ?`
  return new Promise((resolve, reject) => {
    db.all(`select ${select} from ${table} where ${key} ${query}`, value, function(err, res) {
      if (!err) {
        resolve(res.length === 1 ? res[0] : res)
      } else {
        reject(err)
      }
    })
  })
}

const updateData = (table, data, condition = {}) => {
  data = {
    ...data,
    updated_at: now()
  }
  let values = []
  let updateData = Object.entries(data).map(d => {
    values.push(d[1])
    return `${d[0]} = ?`
  }).join(', ')
  let conditionStr = `${Object.keys(condition)[0]} = ?`
  values.push(condition[Object.keys(condition)[0]])

  return new Promise((resolve, reject) => {
    db.run(`update ${table} set ${updateData} where ${conditionStr}`, values, function(err) {
      if (!err) {
        queryData(table, Object.keys(condition)[0], condition[Object.keys(condition)[0]]).then(res => {
          resolve(res)
        }).catch(err)
      } else {
        reject(err)
      }
    })
  })
}

const createData = (table, data) => {
  data = {
    ...data,
    created_at: now(),
    updated_at: now()
  }
  let keys = Object.keys(data)
  let placehloder = keys.map(k => '?')
  let values = Object.values(data)
  return new Promise((resolve, reject) => {
    db.run(`insert into ${table}(${keys}) values(${placehloder})`, [...values] ,function(err) {
      if (!err) {
        queryData(table, 'id', this.lastID).then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })
      } else {
        reject(err)
      }
    })
  })
}

let methods = {
  dbInit,
  queryData,
  createData,
  updateData,
  db
}

export default methods
