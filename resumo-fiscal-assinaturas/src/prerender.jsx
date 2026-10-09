import React from 'react'
import {renderToString} from 'react-dom/server'
import fs from 'node:fs'
import Account from './Account.jsx'
const html=fs.readFileSync('dist/index.html','utf8')
fs.writeFileSync('dist/index.html',html.replace('<div id="root"></div>','<div id="root">'+renderToString(<Account />)+'</div>'))
