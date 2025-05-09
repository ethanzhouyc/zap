/**
 *
 *    Copyright (c) 2020 Silicon Labs
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
 */

/**
 * This module provides queries related to packages.
 *
 * @module DB API: package-based queries.
 */

const dbApi = require('./db-api.js')
const dbMapping = require('./db-mapping.js')
const dbEnum = require('../../src-shared/db-enum.js')
const querySession = require('./query-session')

const querySelectFromPackage = `
SELECT
  PACKAGE_ID,
  PATH,
  TYPE,
  CRC,
  VERSION,
  CATEGORY,
  DESCRIPTION,
  IS_IN_SYNC
FROM PACKAGE `

/**
 * Checks if the package with a given path exists and executes appropriate action.
 * Returns the promise that resolves the the package or null if nothing was found.
 *
 * @export
 * @param {*} db
 * @param {*} path Path of a file to check.
 */
async function getPackageByPathAndParent(db, path, parentId, isCustom) {
  return dbApi
    .dbGet(
      db,
      `${querySelectFromPackage} WHERE PATH = ? AND ${
        isCustom ? 'PARENT_PACKAGE_REF IS NULL' : '(PARENT_PACKAGE_REF = ?)'
      }`,
      isCustom ? [path] : [path, parentId]
    )
    .then(dbMapping.map.package)
}

/**
 * Get packages that have a given parent.
 *
 * @param {*} db
 * @param {*} parentId
 * @returns promise that resolves into an array of packages.
 */
async function getPackageByParent(db, parentId) {
  return dbApi
    .dbAll(db, `${querySelectFromPackage} WHERE PARENT_PACKAGE_REF = ?`, [
      parentId
    ])
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Get zcl properties package from an array of packages.
 *
 * @param {*} db
 * @param {*} packages
 * @returns promise that resolves into an array of packages.
 */
async function getZclPropertiesPackage(db, packages) {
  const packageIds = packages.map((singlePackage) => singlePackage.packageRef)
  return dbApi
    .dbAll(
      db,
      `${querySelectFromPackage} WHERE TYPE = 'zcl-properties' AND PACKAGE_ID in (${packageIds.join(
        ','
      )})`
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Returns the package by path and type.
 *
 * @param {*} db
 * @param {*} path
 * @param {*} type
 * @returns Promise of a query.
 */
async function getPackageByPathAndType(db, path, type) {
  return dbApi
    .dbGet(
      db,
      `${querySelectFromPackage} WHERE PATH = ? AND TYPE = ? AND IS_IN_SYNC = 1`,
      [path, type]
    )
    .then(dbMapping.map.package)
}

/**
 * Returns the package ID by path and type and version.
 *
 * @param {*} db
 * @param {*} path
 * @param {*} type
 * @param {*} version
 * @returns Promise of a query.
 */
async function getPackageIdByPathAndTypeAndVersion(db, path, type, version) {
  // Version can be null for custom xml
  let packageQuery =
    `
    SELECT
      PACKAGE_ID
    FROM
      PACKAGE
    WHERE
      IS_IN_SYNC = 1
    AND
      PATH = '${path}'
    AND
      TYPE = '${type}'
    AND ` + (version ? `VERSION = '${version}'` : `VERSION IS NULL`)
  return dbApi.dbGet(db, packageQuery).then((row) => {
    if (row == null) return null
    else return row.PACKAGE_ID
  })
}

/**
 * Returns packages of a given type.
 *
 * @param {*} db
 * @param {*} type
 * @returns A promise that resolves into the rows array of packages.
 */
async function getPackagesByType(db, type) {
  return dbApi
    .dbAll(db, `${querySelectFromPackage} WHERE TYPE = ? AND IS_IN_SYNC = 1`, [
      type
    ])
    .then((rows) => rows.map(dbMapping.map.package))
}
/**
 * Returns packages of a given type.
 *
 * @param {*} db
 * @param {*} type
 * @returns A promise that resolves into the rows array of packages.
 */
async function getPackagesByCategoryAndType(db, type, category = '') {
  return dbApi
    .dbAll(
      db,
      `${querySelectFromPackage} WHERE IS_IN_SYNC = 1 AND TYPE = ? AND (CATEGORY IN (${category}) OR CATEGORY IS NULL)`,
      [type]
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Returns packages of a given type and parent.
 *
 * @param {*} db
 * @param {*} type
 * @returns A promise that resolves into the rows array of packages.
 */
async function getPackagesByParentAndType(db, parentId, type) {
  return dbApi
    .dbAll(
      db,
      `${querySelectFromPackage} WHERE TYPE = ? AND PARENT_PACKAGE_REF = ?`,
      [type, parentId]
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Checks if the package with a given package id exists and executes appropriate action.
 * Returns the promise that resolves the package or null if nothing was found.
 *
 * @export
 * @param {*} db
 * @param {*} packageId
 */
async function getPackageByPackageId(db, packageId) {
  return dbApi
    .dbGet(db, `${querySelectFromPackage} WHERE PACKAGE_ID = ?`, [packageId])
    .then(dbMapping.map.package)
}

/**
 * Checks if packages with given package ids exist and executes appropriate action.
 * Returns the promise that resolves the packages or null if nothing was found.
 *
 * @export
 * @param {*} db
 * @param {*} packageIds
 */
async function getPackagesByPackageIds(db, packageIds) {
  return dbApi
    .dbAll(
      db,
      `${querySelectFromPackage} WHERE PACKAGE_ID IN (${dbApi.toInClause(
        packageIds
      )})`
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Returns a package ref from the attribute ID
 *
 * @param db
 * @param attributeId
 * @returns package ref
 */
async function getPackageRefByAttributeId(db, attributeId) {
  let package_ref = await dbApi.dbAll(
    db,
    'SELECT PACKAGE_REF FROM ATTRIBUTE WHERE ATTRIBUTE_ID = ?',
    [attributeId]
  )
  return package_ref[0].PACKAGE_REF
}

/**
 * Resolves with a CRC or null for a given path.
 *
 * @export
 * @param {*} db
 * @param {*} path
 * @returns Promise resolving with a CRC or null.
 */
async function getPathCrc(db, path) {
  return dbApi
    .dbGet(db, 'SELECT CRC FROM PACKAGE WHERE PATH = ? AND IS_IN_SYNC = 1', [
      path
    ])
    .then(
      (row) =>
        new Promise((resolve, reject) => {
          if (row == null) {
            resolve(null)
          } else {
            resolve(row.CRC)
          }
        })
    )
}

/**
 * Updates the version inside the package.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} version
 * @returns A promise of an updated version.
 */
async function updateVersion(db, packageId, version, category, description) {
  return dbApi.dbUpdate(
    db,
    'UPDATE PACKAGE SET VERSION = ?, CATEGORY = ?, DESCRIPTION = ? WHERE PACKAGE_ID = ?',
    [version, category, description, packageId]
  )
}

/**
 * Inserts a given path CRC type combination into the package table.
 *
 * @param {*} db
 * @param {*} path Path of the file.
 * @param {*} crc CRC of the file.
 * @returns Promise of an insertion.
 */
async function insertPathCrc(
  db,
  path,
  crc,
  type,
  parentId = null,
  version = null,
  category = null,
  description = null
) {
  return dbApi.dbInsert(
    db,
    'INSERT INTO PACKAGE ( PATH, CRC, TYPE, PARENT_PACKAGE_REF, VERSION, CATEGORY, DESCRIPTION ) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [path, crc, type, parentId, version, category, description]
  )
}
/**
 * Inserts or updates a package. Resolves with a packageId.
 *
 * @param {*} db
 * @param {*} path
 * @param {*} crc
 * @param {*} type
 * @param {*} [parentId=null]
 * @returns An object containing: id, existedPreviously
 */
async function registerTopLevelPackage(
  db,
  path,
  crc,
  type,
  version = null,
  category = null,
  description = null,
  isTopLevelPackageInSync = true
) {
  let row = await getPackageByPathAndType(db, path, type)
  if (row == null || !isTopLevelPackageInSync) {
    // Doesn't exist. We have to add it.
    let id = await dbApi.dbInsert(
      db,
      `
INSERT INTO PACKAGE (
  PATH, CRC, TYPE, PARENT_PACKAGE_REF, VERSION, CATEGORY, DESCRIPTION
) VALUES (?,?,?,?,?,?,?)`,
      [path, crc, type, null, version, category, description]
    )
    return {
      id: id,
      existedPreviously: false
    }
  } else {
    // Exists. We just return it.
    return {
      id: row.id,
      existedPreviously: true
    }
  }
}

/**
 * Updates a CRC in the table.
 *
 * @export
 * @param {*} db
 * @param {*} path
 * @param {*} crc
 * @returns Promise of an update.
 */
async function updatePathCrc(db, path, crc, parentId) {
  return dbApi.dbUpdate(
    db,
    'UPDATE PACKAGE SET CRC = ? WHERE PATH = ? AND PARENT_PACKAGE_REF = ?',
    [crc, path, parentId]
  )
}

/**
 * Updates a is in sync in the package table.
 * @param {*} db
 * @param {*} packageRef
 * @param {*} isInSync
 * @returns Promise of an update.
 */
async function updatePackageIsInSync(db, packageRef, isInSync) {
  return dbApi.dbUpdate(
    db,
    'UPDATE PACKAGE SET IS_IN_SYNC = ? WHERE PACKAGE_ID = ?',
    [dbApi.toDbBool(isInSync), packageRef]
  )
}

/**
 * Inserts a mapping between session and package.
 *
 * @param {*} db
 * @param {*} sessionPartitionId
 * @param {*} packageId
 * @param {*} required
 * @returns Promise of an insert.
 */
async function insertSessionPackage(
  db,
  sessionPartitionId,
  packageId,
  required = false
) {
  return dbApi.dbInsert(
    db,
    'INSERT OR REPLACE INTO SESSION_PACKAGE (SESSION_PARTITION_REF, PACKAGE_REF, REQUIRED, ENABLED) VALUES (?,?,?,1)',
    [sessionPartitionId, packageId, required]
  )
}

/**
 * @param {*} db
 * @param {*} sessionPartitionId
 * @param {*} packageType
 */
async function deleteSessionPackage(db, sessionPartitionId, packageId) {
  return dbApi.dbRemove(
    db,
    `UPDATE SESSION_PACKAGE SET ENABLED = 0 WHERE SESSION_PARTITION_REF = ? AND PACKAGE_REF = ?`,
    [sessionPartitionId, packageId]
  )
}

/**
 * Deletes all session packages based on sessionPartitionIds.
 *
 * @param {*} db
 * @param {*} sessionPartitionIds
 * @returns promise
 */
async function deleteAllSessionPackages(db, sessionPartitionIds) {
  await dbApi.dbRemove(
    db,
    `DELETE FROM SESSION_PACKAGE WHERE SESSION_PARTITION_REF IN (${dbApi.toInClause(
      sessionPartitionIds
    )})`
  )
  return dbApi.dbRemove(
    db,
    `DELETE FROM SESSION_PARTITION WHERE SESSION_PARTITION_ID IN (${dbApi.toInClause(
      sessionPartitionIds
    )})`
  )
}

/**
 * Returns session packages of a given type.
 *
 * @param {*} db
 * @param {*} sessionId
 * @param {*} packageType
 * @returns Promise that resolves into array of retrieve packages.
 */
async function getSessionPackagesByType(db, sessionId, packageType) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  PACKAGE.PACKAGE_ID,
  PACKAGE.PATH,
  PACKAGE.TYPE,
  PACKAGE.CRC,
  PACKAGE.VERSION,
  PACKAGE.CATEGORY,
  PACKAGE.DESCRIPTION
FROM PACKAGE
INNER JOIN SESSION_PACKAGE
  ON PACKAGE.PACKAGE_ID = SESSION_PACKAGE.PACKAGE_REF
INNER JOIN
  SESSION_PARTITION
ON
  SESSION_PACKAGE.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
WHERE SESSION_PARTITION.SESSION_REF = ?
  AND PACKAGE.TYPE = ?
  AND SESSION_PACKAGE.ENABLED = 1`,
      [sessionId, packageType]
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Returns session generation template packages.
 *
 * @param {*} db
 * @param {*} sessionId
 * @returns Promise that resolves into array of retrieve packages.
 */
async function getSessionGenTemplates(db, sessionId) {
  return dbApi
    .dbAll(
      db,
      `
      SELECT
      PACKAGE.PACKAGE_ID,
      PACKAGE.PATH,
      PACKAGE.TYPE,
      PACKAGE.CRC,
      PACKAGE.VERSION,
      PACKAGE.CATEGORY,
      PACKAGE.DESCRIPTION
    FROM PACKAGE
    WHERE
    PACKAGE.TYPE = ? AND
    PACKAGE.PARENT_PACKAGE_REF =
    (SELECT
      PACKAGE.PACKAGE_ID
    FROM PACKAGE
    INNER JOIN SESSION_PACKAGE
      ON PACKAGE.PACKAGE_ID = SESSION_PACKAGE.PACKAGE_REF
    INNER JOIN
      SESSION_PARTITION
    ON
      SESSION_PACKAGE.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
    WHERE SESSION_PARTITION.SESSION_REF = ?
      AND PACKAGE.TYPE = ?
      AND SESSION_PACKAGE.ENABLED = 1)
      ORDER BY PACKAGE.PATH ASC`,
      [
        dbEnum.packageType.genSingleTemplate,
        sessionId,
        dbEnum.packageType.genTemplatesJson
      ]
    )
    .then((rows) => rows.map(dbMapping.map.package))
}

/**
 * Resolves into an array of package objects that all the ZCL queries should resolve into.
 * @param {*} db
 * @param {*} sessionId
 */
async function getSessionZclPackages(db, sessionId) {
  let inList = `('${dbEnum.packageType.zclProperties}', '${dbEnum.packageType.zclXmlStandalone}')`
  return dbApi
    .dbAll(
      db,
      `
SELECT
  SP.PACKAGE_REF,
  SESSION_PARTITION.SESSION_REF,
  SESSION_PARTITION.SESSION_PARTITION_ID,
  SP.REQUIRED,
  P.CATEGORY,
  P.TYPE
FROM
  SESSION_PARTITION
INNER JOIN
  SESSION_PACKAGE AS SP
ON
  SP.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
INNER JOIN
  PACKAGE AS P
ON
  SP.PACKAGE_REF = P.PACKAGE_ID
WHERE
  SESSION_PARTITION.SESSION_REF = ? AND SP.ENABLED = 1 AND P.TYPE IN ${inList}
`,
      [sessionId]
    )
    .then((rows) => rows.map(dbMapping.map.sessionPackage))
}

/**
 * Resolves into an array of IDs that are the packageIds that all the ZCL queries should resolve into.
 * @param {*} db
 * @param {*} sessionId
 */
async function getSessionZclPackageIds(db, sessionId) {
  return getSessionZclPackages(db, sessionId).then((rows) =>
    rows.map((r) => r.packageRef)
  )
}

/**
 * Returns the session package IDs.
 * @param {*} db
 * @param {*} sessionId
 * @returns The promise that resolves into an array of package IDs.
 */
async function getSessionPackages(db, sessionId) {
  return dbApi
    .dbAll(
      db,
      `
      SELECT
        SESSION_PACKAGE.PACKAGE_REF,
        SESSION_PARTITION.SESSION_REF,
        SESSION_PACKAGE.REQUIRED
      FROM
        SESSION_PACKAGE
      INNER JOIN
        SESSION_PARTITION
      ON
        SESSION_PACKAGE.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
      WHERE
        SESSION_PARTITION.SESSION_REF = ? AND SESSION_PACKAGE.ENABLED = 1`,
      [sessionId]
    )
    .then((rows) => rows.map(dbMapping.map.sessionPackage))
}

/**
 * Returns the session package IDs with types.
 * @param {*} db
 * @param {*} sessionId
 * @returns The promise that resolves into an array of package IDs.
 */
async function getSessionPackagesWithTypes(db, sessionId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  SP.PACKAGE_REF,
  SESSION_PARTITION.SESSION_REF,
  SP.REQUIRED,
  P.TYPE,
  SESSION_PARTITION.SESSION_PARTITION_ID
FROM
  SESSION_PARTITION
INNER JOIN
  SESSION_PACKAGE AS SP
ON
  SP.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
INNER JOIN
  PACKAGE AS P
ON
  SP.PACKAGE_REF = P.PACKAGE_ID
WHERE
  SESSION_PARTITION.SESSION_REF = ? AND SP.ENABLED = 1`,
      [sessionId]
    )
    .then((rows) => rows.map(dbMapping.map.sessionPackage))
}

/**
 * Returns all packages associated w/ a given sessionId
 * @param {*} db
 * @param {*} sessionId
 */
async function getPackageSessionPackagePairBySessionId(db, sessionId) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  P.PACKAGE_ID,
  P.PATH,
  P.TYPE,
  P.CRC,
  P.VERSION,
  P.CATEGORY,
  P.DESCRIPTION,
  P.PARENT_PACKAGE_REF,
  SP.PACKAGE_REF,
  SESSION_PARTITION.SESSION_REF,
  SP.REQUIRED
FROM
  PACKAGE AS P
INNER JOIN
  SESSION_PACKAGE AS SP
ON
  P.PACKAGE_ID = SP.PACKAGE_REF
INNER JOIN
  SESSION_PARTITION
ON
  SP.SESSION_PARTITION_REF= SESSION_PARTITION.SESSION_PARTITION_ID
WHERE
  SESSION_PARTITION.SESSION_REF = ?
  AND SP.ENABLED = 1`,
    [sessionId]
  )
  return rows.map((x) => {
    return {
      pkg: dbMapping.map.package(x),
      sessionPackage: dbMapping.map.sessionPackage(x)
    }
  })
}

/**
 * Returns all packages
 * @param {*} db
 */
async function getAllPackages(db) {
  return dbApi
    .dbAll(
      db,
      `SELECT
        PACKAGE_ID,
        PATH,
        TYPE,
        CRC,
        VERSION,
        CATEGORY,
        DESCRIPTION,
        PARENT_PACKAGE_REF
       FROM
        PACKAGE
       WHERE
        IS_IN_SYNC = 1`
    )
    .then((rows) => rows.map(dbMapping.map.package))
}
/**
 * Retrieves attribute access interface options from the database.
 *
 * This function performs a complex query to fetch options related to a specific code and package IDs. It combines results from
 * the PACKAGE_OPTION table with those from ATTRIBUTE and CLUSTER tables using a UNION. The purpose is to gather a comprehensive
 * list of options that include both direct package options and those inferred from attributes' storage policies and their associated
 * clusters. It supports querying for multiple package IDs by ensuring the packageIds parameter is treated as an array, allowing
 * for more flexible queries.
 *
 * @param {Object} db - The database connection object.
 * @param {string} code - The option code or storage policy code to query for.
 * @param {number|Array<number>} packageIds - The ID(s) of the package(s) to which the options are related. Can be a single ID or an array of IDs.
 * @returns {Promise<Array>} A promise that resolves to an array of option objects, each containing the option category, code, and label.
 */
async function getAttributeAccessInterface(db, code, packageIds) {
  try {
    // Ensure packageIds is always an array
    if (!Array.isArray(packageIds)) {
      packageIds = [packageIds]
    }

    let packageRefCondition = `po.PACKAGE_REF = ?`
    let attributePackageRefCondition = `a.PACKAGE_REF = ?`
    let queryParams = [code, ...packageIds, code, ...packageIds]

    // Since packageIds is now always an array, adjust the query and parameters accordingly
    const placeholders = packageIds.map(() => '?').join(', ')
    packageRefCondition = `po.PACKAGE_REF IN (${placeholders})`
    attributePackageRefCondition = `a.PACKAGE_REF IN (${placeholders})`

    const extendedQuery = `
      SELECT
          po.OPTION_CATEGORY,
          po.OPTION_CODE,
          po.OPTION_LABEL
      FROM
          PACKAGE_OPTION po
      WHERE
          po.OPTION_CODE = ?
          AND ${packageRefCondition}

      UNION

      SELECT
          c.NAME AS OPTION_CATEGORY,
          a.STORAGE_POLICY AS OPTION_CODE,
          a.NAME AS OPTION_LABEL
      FROM
          ATTRIBUTE a
      LEFT JOIN CLUSTER c ON a.CLUSTER_REF = c.CLUSTER_ID
      WHERE
          a.STORAGE_POLICY = ?
          AND ${attributePackageRefCondition}
    `

    return dbApi
      .dbAll(db, extendedQuery, queryParams)
      .then((rows) => rows.map(dbMapping.map.options))
  } catch (error) {
    console.error('Error fetching attribute access interface:', error)
    throw error // Rethrow the error for further handling if necessary
  }
}

/**
 * This async function inserts an option and its values into the DB.
 *
 * @param {*} db
 * @param {*} packageId - Package Reference
 * @param {*} optionCategory - The name of the option.
 * @param {*} optionCodeLabels - The array of values associated with this option.
 */
async function insertOptionsKeyValues(
  db,
  packageId,
  optionCategory,
  optionCodeLabels
) {
  return dbApi.dbMultiInsert(
    db,
    `INSERT INTO PACKAGE_OPTION
        (PACKAGE_REF, OPTION_CATEGORY, OPTION_CODE, OPTION_LABEL)
       VALUES
        (?, ?, ?, ?)
       ON CONFLICT
        (PACKAGE_REF, OPTION_CATEGORY, OPTION_CODE, OPTION_LABEL)
       DO NOTHING`,
    optionCodeLabels.map((optionValue) => {
      return [packageId, optionCategory, optionValue.code, optionValue.label]
    })
  )
}

/**
 * Shortcut method that returns all ui options.
 * @param {*} db
 * @param {*} packageId
 * @returns object of ui options.
 */
async function selectAllUiOptions(db, packageId) {
  let rows = await selectAllOptionsValues(
    db,
    packageId,
    dbEnum.packageOptionCategory.ui
  )
  let obj = rows.reduce((prev, cur) => {
    prev[cur.optionCode] = cur.optionLabel
    return prev
  }, {})
  return obj
}

/**
 * This async function returns all options associated with a specific category.
 * @param {*} db
 * @param {*} packageId
 * @param {*} optionCategory
 * @returns promise to return option that matches arguments.
 */
async function selectAllOptionsValues(db, packageId, optionCategory) {
  return dbApi
    .dbAll(
      db,
      `SELECT OPTION_ID, PACKAGE_REF, OPTION_CATEGORY, OPTION_CODE, OPTION_LABEL FROM PACKAGE_OPTION WHERE PACKAGE_REF = ? AND OPTION_CATEGORY = ?`,
      [packageId, optionCategory]
    )
    .then((rows) => rows.map(dbMapping.map.options))
}

/**
 *
 * This async function returns option associated with a specific category and code.
 * @param {*} db
 * @param {*} packageId
 * @param {*} optionCategory
 * @param {*} optionCode
 * @returns promise to return option that matches arguments.
 */
async function selectSpecificOptionValue(
  db,
  packageId,
  optionCategory,
  optionCode
) {
  return dbApi
    .dbGet(
      db,
      `SELECT OPTION_ID, PACKAGE_REF, OPTION_CATEGORY, OPTION_CODE, OPTION_LABEL FROM PACKAGE_OPTION WHERE PACKAGE_REF = ? AND OPTION_CATEGORY = ? AND OPTION_CODE = ?`,
      [packageId, optionCategory, optionCode]
    )
    .then(dbMapping.map.options)
}

/**
 * This async function returns a specific option value given an option reference.
 * @param {*} db
 * @param {*} optionDefaultId
 */
async function selectOptionValueByOptionDefaultId(db, optionDefaultId) {
  return dbApi
    .dbGet(
      db,
      `SELECT OPTION_ID, PACKAGE_REF, OPTION_CATEGORY, OPTION_CODE, OPTION_LABEL FROM PACKAGE_OPTION WHERE OPTION_ID = ?`,
      [optionDefaultId]
    )
    .then(dbMapping.map.options)
}

/**
 * Returns a promise of an insertion of option value.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} optionCategory
 * @param {*} optionRef
 * @returns promise to insert option value
 */
async function insertDefaultOptionValue(
  db,
  packageId,
  optionCategory,
  optionRef
) {
  return dbApi.dbInsert(
    db,
    'INSERT INTO PACKAGE_OPTION_DEFAULT ( PACKAGE_REF, OPTION_CATEGORY, OPTION_REF) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    [packageId, optionCategory, optionRef]
  )
}

/**
 * Returns a promise for all option values.
 * @param {*} db
 * @param {*} packageId
 */
async function selectAllDefaultOptions(db, packageId) {
  return dbApi
    .dbAll(
      db,
      `SELECT OPTION_DEFAULT_ID, PACKAGE_REF, OPTION_CATEGORY, OPTION_REF FROM PACKAGE_OPTION_DEFAULT WHERE PACKAGE_REF = ?`,
      [packageId]
    )
    .then((rows) => rows.map(dbMapping.map.optionDefaults))
}

/**
 * Inserts an array of extension default values to a specific extension ID.
 *
 * @param {*} db
 * @param {*} packageExtensionId
 * @param {*} defaultArray Array containing objects with 'entityCode', 'parentCode', 'manufacturerCode', 'entityQualifier', 'value'
 * @returns Promise of insertion for defaults.
 */
async function insertPackageExtensionDefault(
  db,
  packageExtensionId,
  defaultArray
) {
  return dbApi.dbMultiInsert(
    db,
    `
INSERT INTO PACKAGE_EXTENSION_DEFAULT (
  PACKAGE_EXTENSION_REF,
  ENTITY_CODE,
  ENTITY_QUALIFIER,
  PARENT_CODE,
  MANUFACTURER_CODE,
  VALUE
) VALUES ( ?, ?, ?, ?, ?, ? )
ON CONFLICT DO NOTHING
    `,
    defaultArray.map((d) => {
      return [
        packageExtensionId,
        d.entityCode,
        d.entityQualifier,
        d.parentCode,
        d.manufacturerCode,
        d.value
      ]
    })
  )
}

/**
 * Returns a promise of insertion of package extension
 *
 * @param {*} db
 * @param {*} packageId
 * @param propertyArray. Array of objects that contain property, type, configurability, label, globalDefault
 * @param defaultsArrayOfArrays For each item in propertyArray, it contains array of default rows, or null.
 */
async function insertPackageExtension(
  db,
  packageId,
  entity,
  propertyArray,
  defaultsArrayOfArrays
) {
  return dbApi
    .dbMultiInsert(
      db,
      `
INSERT INTO PACKAGE_EXTENSION (
  PACKAGE_REF,
  ENTITY,
  PROPERTY,
  TYPE,
  CONFIGURABILITY,
  LABEL,
  GLOBAL_DEFAULT
) VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT DO NOTHING`,
      propertyArray.map((p) => {
        return [
          packageId,
          entity,
          p.property,
          p.type,
          p.configurability,
          p.label,
          p.globalDefault
        ]
      })
    )
    .then((rowIds) => {
      let promises = []
      // now, for each rowId in this list, we populate corresponding defaults
      if (rowIds.length == defaultsArrayOfArrays.length) {
        for (let i = 0; i < rowIds.length; i++) {
          let rowId = rowIds[i]
          let defaultsArray = defaultsArrayOfArrays[i]
          if (defaultsArray != null) {
            promises.push(
              insertPackageExtensionDefault(db, rowId, defaultsArray)
            )
          }
        }
      }
      return Promise.all(promises)
    })
}

/**
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} property
 * @param {*} entityType One of the packageExtensionEntity enums
 */
async function selectPackageExtensionByPropertyAndEntity(
  db,
  packageId,
  property,
  entity
) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  PE.TYPE,
  PE.CONFIGURABILITY,
  PE.LABEL,
  PE.GLOBAL_DEFAULT,
  PED.ENTITY_CODE,
  PED.ENTITY_QUALIFIER,
  PED.PARENT_CODE,
  PED.MANUFACTURER_CODE,
  PED.VALUE
FROM
  PACKAGE_EXTENSION AS PE
LEFT OUTER JOIN
  PACKAGE_EXTENSION_DEFAULT AS PED
ON
  PE.PACKAGE_EXTENSION_ID = PED.PACKAGE_EXTENSION_REF
WHERE
  PE.PACKAGE_REF = ?
  AND PE.ENTITY = ?
  AND PE.PROPERTY = ?
ORDER BY
  PE.PROPERTY,
  PED.PARENT_CODE,
  PED.ENTITY_CODE`,
    [packageId, entity, property]
  )
  if (rows != null && rows.length > 0) {
    let res = {
      type: rows[0].TYPE,
      configurability: rows[0].CONFIGURABILITY,
      label: rows[0].LABEL,
      globalDefault: rows[0].GLOBAL_DEFAULT,
      defaults: []
    }
    return rows.reduce((acc, x) => {
      acc.defaults.push({
        entityCode: x.ENTITY_CODE,
        parentCode: x.PARENT_CODE,
        manufacturerCode: x.MANUFACURER_CODE,
        qualifier: x.ENTITY_QUALIFIER,
        value: x.VALUE
      })
      return acc
    }, res)
  } else {
    return null
  }
}

/**
 * Select extensions for a given entity type for a package.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} entity
 * @returns promise that resolve into an array of packageExtensions for a given entity
 */
async function selectPackageExtension(db, packageId, entity) {
  let acc = []
  return dbApi
    .dbAll(
      db,
      `
SELECT
  PE.ENTITY,
  PE.PROPERTY,
  PE.TYPE,
  PE.CONFIGURABILITY,
  PE.LABEL,
  PE.GLOBAL_DEFAULT,
  PED.ENTITY_CODE,
  PED.ENTITY_QUALIFIER,
  PED.PARENT_CODE,
  PED.MANUFACTURER_CODE,
  PED.VALUE
FROM
  PACKAGE_EXTENSION AS PE
LEFT OUTER JOIN
  PACKAGE_EXTENSION_DEFAULT AS PED
ON
  PE.PACKAGE_EXTENSION_ID = PED.PACKAGE_EXTENSION_REF
WHERE
  PE.PACKAGE_REF = ?
  AND PE.ENTITY = ?
ORDER BY
  PE.PROPERTY,
  PED.PARENT_CODE,
  PED.ENTITY_CODE`,
      [packageId, entity]
    )
    .then((rows) =>
      rows.reduce((a, x) => {
        let newPropRequired
        if (a.length == 0 || a[a.length - 1].property != x.PROPERTY) {
          newPropRequired = true
        } else {
          newPropRequired = false
        }

        let prop
        if (newPropRequired) {
          prop = dbMapping.map.packageExtension(x)
          prop.defaults = []
          a.push(prop)
        } else {
          prop = a[a.length - 1]
        }

        prop.defaults.push(dbMapping.map.packageExtensionDefault(x))
        return a
      }, acc)
    )
}

/**
 * Takes defaults key values from package, and inserts them into the session
 * as initial values.
 *
 * @param {*} db
 * @param {*} sessionId
 * @returns the list of packages from getSessionPackages()
 */
async function insertSessionKeyValuesFromPackageDefaults(db, sessionId) {
  let packages = await getSessionPackages(db, sessionId)
  let p = packages.map(async (pkg) => {
    let optionDefaultsArray = await selectAllDefaultOptions(db, pkg.packageRef)
    let promises = optionDefaultsArray.map(async (optionDefault) => {
      let option = await selectOptionValueByOptionDefaultId(
        db,
        optionDefault.optionRef
      )
      return querySession.insertSessionKeyValue(
        db,
        sessionId,
        option.optionCategory,
        option.optionCode
      )
    })
    return Promise.all(promises)
  })
  await Promise.all(p)
  return packages
}

// exports
exports.getAttributeAccessInterface = getAttributeAccessInterface
exports.getPackageRefByAttributeId = getPackageRefByAttributeId
exports.getPackageByPathAndParent = getPackageByPathAndParent
exports.getPackageByPackageId = getPackageByPackageId
exports.getPackagesByType = getPackagesByType
exports.getPackageByParent = getPackageByParent
exports.getPackageIdByPathAndTypeAndVersion =
  getPackageIdByPathAndTypeAndVersion
exports.getPackageSessionPackagePairBySessionId =
  getPackageSessionPackagePairBySessionId
exports.getPathCrc = getPathCrc
exports.getZclPropertiesPackage = getZclPropertiesPackage
exports.insertPathCrc = insertPathCrc
exports.updatePathCrc = updatePathCrc
exports.registerTopLevelPackage = registerTopLevelPackage
exports.updateVersion = updateVersion
exports.insertSessionPackage = insertSessionPackage
exports.getSessionPackages = getSessionPackages
exports.getSessionPackagesWithTypes = getSessionPackagesWithTypes
exports.insertOptionsKeyValues = insertOptionsKeyValues
exports.selectAllOptionsValues = selectAllOptionsValues
exports.selectSpecificOptionValue = selectSpecificOptionValue
exports.insertDefaultOptionValue = insertDefaultOptionValue
exports.getSessionPackagesByType = getSessionPackagesByType
exports.getSessionGenTemplates = getSessionGenTemplates
exports.selectAllDefaultOptions = selectAllDefaultOptions
exports.selectOptionValueByOptionDefaultId = selectOptionValueByOptionDefaultId
exports.getPackagesByParentAndType = getPackagesByParentAndType
exports.getSessionZclPackages = getSessionZclPackages
exports.getSessionZclPackageIds = getSessionZclPackageIds
exports.getAllPackages = getAllPackages
exports.deleteAllSessionPackages = deleteAllSessionPackages
exports.insertPackageExtension = insertPackageExtension
exports.selectPackageExtension = selectPackageExtension
exports.selectPackageExtensionByPropertyAndEntity =
  selectPackageExtensionByPropertyAndEntity
exports.deleteSessionPackage = deleteSessionPackage
exports.selectAllUiOptions = selectAllUiOptions
exports.insertSessionKeyValuesFromPackageDefaults =
  insertSessionKeyValuesFromPackageDefaults
exports.getPackagesByCategoryAndType = getPackagesByCategoryAndType
exports.getPackagesByPackageIds = getPackagesByPackageIds
exports.getPackageByPathAndType = getPackageByPathAndType
exports.updatePackageIsInSync = updatePackageIsInSync
