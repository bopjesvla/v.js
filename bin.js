#!/usr/bin/env node

var v = require('.')
var fs = require('fs')
var path = require('path')
var f = path.join.bind(path, process.cwd())

var args = require('yargs')
    .alias('c', 'client')
    .alias('U', 'client.user')
    .alias('h', 'client.host')
    .alias('d', 'client.database')
    .alias('t', 'tables')
    .array('file')
    .alias('f', 'file')
    .argv

if (args.file) {
    args.sql = args.file.map(i => fs.readFileSync(f(i), 'utf8'))
}

var cb = (err, res) => {
    if (err) {
        throw err
    }
    if (args.out) {
        var absPath = f(args.out)
        fs.writeFileSync(absPath, res)
        console.log(`Schema written to ${absPath}`)
    }
    else {
        console.log(res)
    }
}

v(args, cb)
