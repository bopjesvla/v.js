var helpers = require('./helpers')

var extend = helpers.utils.extend, merge = function(a, b) {
  var c = extend({}, a)
  extend(c, b)
  return c
}

var Table = function(schema, name, opts, helpers) {
  this.schema = schema
  this.name = name
  this.opts = opts
  this.helpers = helpers
}

var Schema = module.exports = function(schemas, opts) {
  schemas = [].concat(schemas)
  var schemaHelpers = extend({}, helpers)
  schemaHelpers.fn = {}
  opts = opts || {}
  var schema = {checks: {}, tables: {}}

  var self = function(tableName) {
    return new Table(schema, tableName, opts, schemaHelpers)
  }

  self.extend = function(newschema) {
    extend(schema.checks, newschema.checks)
    extend(schema.tables, newschema.tables)
  }

  for (var i = 0; i < schemas.length; i++) {
    self.extend(schemas[i])
  }

  self.functions = function(fns) {
    extend(schemaHelpers.fn, fns)
  }
  self.options = function(_opts) {
    extend(opts, _opts)
  }
  self.validateCheckConstraint = function(constraint, data) {
    if (schema.checks[constraint]) {
      return {success: schema.checks[constraint](data, schemaHelpers)}
    }
    else {
      return {error: 'constraint_missing', constraint: constraint}
    }
  }
  return self
}

Table.prototype.defaults = function(column, data) {
  var t = this.schema.tables[this.name]
  if (typeof column != 'string') {
    data = column
    column = null
  }
  if (column) {
    if (t.columns[column].default) {
      return t.columns[column].default(data, this.helpers)
    }
    else {
      return t.defaults(data).column
    }
  }
  var defaults = t.defaults ? t.defaults(data) : {}
  for (var column in t.columns) {
    if (!(column in defaults)) {
      defaults[column] = t.columns[column].default ? t.columns[column].default(data, this.helpers) : void 0
    }
  }
  return defaults
}
Table.prototype.validate = function(data, opts) {
  var t = this.schema.tables[this.name]

  opts = merge(this.opts, opts || {}) 

  if (!t) {
    return {error: 'table_missing'}
  }
  if (opts.unknown !== false) {
    for (var field in data) {
      if (!t.columns[field]) {
        return {error: 'unknown_field', violated: [field]}
      }
    }
  }

  var checklist = t.checks, checkobj = {}

  if (Array.isArray(opts.checks)) {
    checklist = opts.checks
  }
  else if (opts.checks != null) {
    checkobj = opts.checks
  }

  if (opts.defaults !== false) {
    var defaults = this.defaults(data)
    data = extend(defaults, data)
  }

  if (opts.partial) {
    for (var column in t.columns) {
      if (data[column] == null) {
        var checks = t.columns[column].checks
        for (var i = 0; i < checks.length; i++) {
          checkobj[checks[i]] = false
        }
      }
    }
  }

  if (opts.columns) {
    for (var column in t.columns) {
      if (opts.columns.indexOf(column) == -1) {
        var checks = t.columns[column].checks
        for (var i = 0; i < checks.length; i++) {
          checkobj[checks[i]] = false
        }
      }
    }
  }


  var violated = []

  if (!opts.partial && opts.notnull !== false) {
    for (var column in t.columns) {
      if ((!opts.columns || opts.columns.indexOf(column) > -1) && t.columns[column].notnull && data[column] == null) {
        violated.push(column + '_not_null')
        if (!opts.checkAll) {
          return {error: 'constraint_violated', violated: violated} 
        }
      }
    }
  }

  for (var i = 0; i < checklist.length; i++) {
    var check_name = checklist[i], check = this.schema.checks[check_name]

    if (!check) {
      return {error: 'constraint_missing', constraint: check_name}
    }

    if (checkobj[check_name] !== false) {
      var result = check(data, this.helpers)
      if (result !== true && result != null) {
        violated.push(check_name)

        if (!opts.checkAll) {
          return {error: 'constraint_violated', violated: violated} 
        }
      }
    }
  }

  if (violated.length) {
    return {error: 'constraint_violated', violated: violated} 
  }

  return {success: true}
}

Table.prototype.assert = function() {
  var v = this.validate.apply(this, arguments)
  if (v.error) {
    var name = v.violated ? v.error + ': ' + v.violated.join(', ') : v.error
    var e = new Error(name)
    extend(e, v)
    throw e
  }
}

module.exports.Table = Table
