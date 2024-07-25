/**
 *
 *    Copyright (c) 2021 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 *
 *
 * @jest-environment node
 */

const dbApi = require('../src-electron/db/db-api')
const zclLoader = require('../src-electron/zcl/zcl-loader')
const env = require('../src-electron/util/env')
const testUtil = require('./test-util')
const testQuery = require('./test-query')
const queryPackage = require('../src-electron/db/query-package')
const queryConfig = require('../src-electron/db/query-config')
const queryDeviceType = require('../src-electron/db/query-device-type')
const querySession = require('../src-electron/db/query-session')

let db
let sid
let code = 0xfff1fc21
let customPackageId
let mainPackageId

beforeAll(async () => {
  env.setDevelopmentEnv()
  let file = env.sqliteTestFile('custom-matter-cluster')
  db = await dbApi.initDatabaseAndLoadSchema(
    file,
    env.schemaFile(),
    env.zapVersion()
  )
  await zclLoader.loadZcl(db, env.builtinSilabsZclMetafile())
  sid = await testQuery.createSession(
    db,
    'USER',
    'SESSION',
    env.builtinSilabsZclMetafile(),
    env.builtinTemplateMetafile()
  )
}, testUtil.timeout.medium())

afterAll(() => dbApi.closeDatabase(db), testUtil.timeout.short())

test(
  'Test initial state of load',
  async () => {
    x = await dbApi.dbAll(db, 'SELECT * FROM CLUSTER WHERE CODE = ?', [code])
    expect(x.length).toEqual(0)

    x = await dbApi.dbAll(db, 'SELECT * FROM ATTRIBUTE WHERE NAME = ?', [
      'SilabsFlipFlop',
    ])
    expect(x.length).toEqual(0)

    x = await dbApi.dbAll(db, 'SELECT * FROM COMMAND WHERE NAME = ?', [
      'SilabsAddArguments',
    ])
    expect(x.length).toEqual(0)
  },
  testUtil.timeout.medium()
)

test(
  'Load custom file and insert a package into the session',
  async () => {
    let result = await zclLoader.loadIndividualFile(
      db,
      testUtil.matterCustomXml,
      sid
    )
    expect(result.succeeded).toBeTruthy()
    expect(result.packageId).not.toBeNull()
    expect(result.packageId).not.toBeUndefined()

    customPackageId = result.packageId
    let sessionPartitionInfo =
      await querySession.selectSessionPartitionInfoFromPackageId(
        db,
        sid,
        result.packageId
      )
    await queryPackage.insertSessionPackage(
      db,
      sessionPartitionInfo[0].sessionPartitionId,
      result.packageId,
      false
    )
  },
  testUtil.timeout.medium()
)

test(
  'Validate custom load and multiple packages in a session',
  async () => {
    x = await dbApi.dbAll(db, 'SELECT * FROM CLUSTER WHERE CODE = ?', [code])
    expect(x.length).toEqual(1)

    let cluster_id = x[0].CLUSTER_ID

    x = await dbApi.dbAll(db, 'SELECT * FROM ATTRIBUTE WHERE CLUSTER_REF = ?', [
      cluster_id,
    ])

    expect(x.length).toEqual(1)

    x = await dbApi.dbAll(db, 'SELECT * FROM COMMAND WHERE CLUSTER_REF = ?', [
      cluster_id,
    ])
    expect(x.length).toEqual(3)

    x = await queryPackage.getSessionPackages(db, sid)
    expect(x.length).toEqual(2)

    expect(
      x[0].packageRef == customPackageId || x[1].packageRef == customPackageId
    ).toBeTruthy()
  },
  testUtil.timeout.medium()
)
