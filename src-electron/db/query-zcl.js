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
 * This module provides queries for ZCL static queries.
 *
 * @module DB API: zcl database access
 */

const dbApi = require('./db-api')
const dbMapping = require('./db-mapping')
const queryAtomic = require('./query-atomic')
const queryEnum = require('./query-enum')
const queryStruct = require('./query-struct')
const queryBitmap = require('./query-bitmap')
const queryDataType = require('./query-data-type')
const queryNumber = require('./query-number')
const queryString = require('./query-string')
const queryDiscriminator = require('./query-data-type-discriminator')

/**
 * Retrieves all the bitmaps that are associated with a cluster.
 * @param {*} db
 * @param {*} packageId
 * @param {*} clusterId
 * @returns cluster-related bitmaps
 */
async function selectClusterBitmaps(db, packageId, clusterId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  B.BITMAP_ID,
  DT.NAME,
  (SELECT COUNT(1) FROM DATA_TYPE_CLUSTER WHERE DATA_TYPE_CLUSTER.DATA_TYPE_REF = B.BITMAP_ID) AS BITMAP_CLUSTER_COUNT,
  B.SIZE
FROM
  BITMAP AS B
INNER JOIN
  DATA_TYPE AS DT
ON
  B.BITMAP_ID = DT.DATA_TYPE_ID
INNER JOIN
  DATA_TYPE_CLUSTER AS DTC
ON
  DTC.DATA_TYPE_REF = DT.DATA_TYPE_ID
WHERE
  DT.PACKAGE_REF = ?
  AND DTC.CLUSTER_REF = ?
ORDER BY DT.NAME`,
      [packageId, clusterId]
    )
    .then((rows) => rows.map(dbMapping.map.bitmap))
}

/**
 * Get bitmap fields from the given bitmap ID.
 * @param {*} db
 * @param {*} id
 * @returns Promise of bitmap fields
 */
async function selectAllBitmapFieldsById(db, id) {
  return dbApi
    .dbAll(
      db,
      'SELECT NAME, MASK, TYPE FROM BITMAP_FIELD WHERE BITMAP_REF = ? ORDER BY FIELD_IDENTIFIER',
      [id]
    )
    .then((rows) => rows.map(dbMapping.map.bitmapField))
}

/**
 * Get all bitmap fields from the given package ID.
 *
 * @param {*} db
 * @param {*} packageId
 * @returns Promise of bitmap fields
 */
async function selectAllBitmapFields(db, packageId) {
  return dbApi
    .dbAll(
      db,
      'SELECT NAME, MASK, BITMAP_REF FROM BITMAP_FIELD  WHERE PACKAGE_REF = ? ORDER BY BITMAP_REF, FIELD_IDENTIFIER',
      [packageId]
    )
    .then((rows) => rows.map(dbMapping.map.bitmapField))
}

/**
 * Retrieves all the domains in the database.
 *
 * @export
 * @param {*} db
 * @returns Promise that resolves with the rows of domains.
 */
async function selectAllDomains(db, packageId) {
  return dbApi
    .dbAll(
      db,
      'SELECT DOMAIN_ID, NAME FROM DOMAIN WHERE PACKAGE_REF = ? ORDER BY NAME',
      [packageId]
    )
    .then((rows) => rows.map(dbMapping.map.domain))
}

/**
 * Get Domain details from the given domain ID.
 * @param {*} db
 * @param {*} id
 * @returns Promise of domain
 */
async function selectDomainById(db, id) {
  return dbApi
    .dbGet(db, 'SELECT DOMAIN_ID, NAME FROM DOMAIN WHERE DOMAIN_ID = ?', [id])
    .then(dbMapping.map.domain)
}

/**
 * Retrieves all the structs in the database, including the count
 * of items.
 *
 * @export
 * @param {*} db
 * @param {*} packageIds
 * @returns Promise that resolves with the rows of structs.
 */
async function selectAllStructsWithItemCount(db, packageIds) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  STRUCT.STRUCT_ID,
  STRUCT.IS_FABRIC_SCOPED,
  STRUCT.API_MATURITY,
  DATA_TYPE.NAME,
  DATA_TYPE.DISCRIMINATOR_REF,
  COUNT(ITEM.NAME) AS ITEM_COUNT
FROM
  STRUCT
INNER JOIN
  DATA_TYPE
ON
  STRUCT.STRUCT_ID = DATA_TYPE.DATA_TYPE_ID
LEFT JOIN
  STRUCT_ITEM AS ITEM
ON
  STRUCT.STRUCT_ID = ITEM.STRUCT_REF
WHERE
  DATA_TYPE.PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
GROUP BY DATA_TYPE.NAME
ORDER BY DATA_TYPE.NAME`
    )
    .then((rows) => rows.map(dbMapping.map.struct))
}

/**
 * Returns an array of clusters that struct belongs to.
 * @param {*} db
 * @param {*} structId
 * @returns clusters
 */
async function selectStructClusters(db, structId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  C.CLUSTER_ID,
  C.CODE,
  C.MANUFACTURER_CODE,
  C.NAME,
  C.DESCRIPTION,
  C.DEFINE,
  C.DOMAIN_NAME,
  C.IS_SINGLETON,
  C.REVISION,
  C.API_MATURITY
FROM
  CLUSTER AS C
INNER JOIN
  DATA_TYPE_CLUSTER AS DTC
ON
  DTC.CLUSTER_REF = C.CLUSTER_ID
INNER JOIN
  STRUCT AS S
ON
  S.STRUCT_ID = DTC.DATA_TYPE_REF
WHERE
  S.STRUCT_ID = ?
ORDER BY C.CODE
    `,
      [structId]
    )
    .then((rows) => rows.map(dbMapping.map.cluster))
}

/**
 * Returns an array of clusters that enum belongs to.
 * @param {*} db
 * @param {*} enumId
 * @returns clusters
 */
async function selectEnumClusters(db, enumId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  C.CLUSTER_ID,
  C.CODE,
  C.MANUFACTURER_CODE,
  C.NAME,
  C.DESCRIPTION,
  C.DEFINE,
  C.DOMAIN_NAME,
  C.IS_SINGLETON,
  C.REVISION,
  C.API_MATURITY
FROM
  CLUSTER AS C
INNER JOIN
  DATA_TYPE_CLUSTER AS DTC
ON
  DTC.CLUSTER_REF = C.CLUSTER_ID
INNER JOIN
  ENUM AS E
ON
  E.ENUM_ID = DTC.DATA_TYPE_REF
WHERE
  E.ENUM_ID = ?
ORDER BY C.CODE
    `,
      [enumId]
    )
    .then((rows) => rows.map(dbMapping.map.cluster))
}

/**
 * Returns an array of clusters that bitmap belongs to.
 * @param {*} db
 * @param {*} bitmapId
 * @returns clusters
 */
async function selectBitmapClusters(db, bitmapId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  C.CLUSTER_ID,
  C.CODE,
  C.MANUFACTURER_CODE,
  C.NAME,
  C.DESCRIPTION,
  C.DEFINE,
  C.DOMAIN_NAME,
  C.IS_SINGLETON,
  C.REVISION,
  C.API_MATURITY
FROM
  CLUSTER AS C
INNER JOIN
  DATA_TYPE_CLUSTER AS DTC
ON
  DTC.CLUSTER_REF = C.CLUSTER_ID
INNER JOIN
  BITMAP AS B
ON
  B.BITMAP_ID = DTC.DATA_TYPE_REF
WHERE
  B.BITMAP_ID = ?
ORDER BY C.CODE    `,
      [bitmapId]
    )
    .then((rows) => rows.map(dbMapping.map.cluster))
}

/**
 * Retrieves all the cluster-related structs in the database with the items.
 *
 * @export
 * @param {*} db
 * @returns Promise that resolves with the rows of structs, each one containing items field with rows of items.
 */
async function selectClusterStructsWithItems(db, packageIds, clusterId) {
  return selectStructsWithItemsImpl(db, packageIds, clusterId)
}

/**
 * Retrieves all the structs in the database with the items.
 *
 * @export
 * @param {*} db
 * @returns Promise that resolves with the rows of structs, each one containing items field with rows of items.
 */
async function selectAllStructsWithItems(db, packageIds) {
  return selectStructsWithItemsImpl(db, packageIds, null)
}

/**
 * Get Struct details along with its struct items.
 *
 * @param {*} db
 * @param {*} packageIds
 * @param {*} clusterId
 * @returns struct details
 */
async function selectStructsWithItemsImpl(db, packageIds, clusterId) {
  let query
  let args = []
  if (clusterId == null) {
    query = `
    SELECT
      S.STRUCT_ID AS STRUCT_ID,
      S.IS_FABRIC_SCOPED AS IS_FABRIC_SCOPED,
      S.API_MATURITY AS API_MATURITY,
      DT.NAME AS STRUCT_NAME,
      (SELECT COUNT(1) FROM DATA_TYPE_CLUSTER WHERE DATA_TYPE_CLUSTER.DATA_TYPE_REF = S.STRUCT_ID) AS STRUCT_CLUSTER_COUNT,
      SI.NAME AS ITEM_NAME,
      SI.FIELD_IDENTIFIER AS ITEM_IDENTIFIER,
      (SELECT DATA_TYPE.NAME FROM DATA_TYPE WHERE DATA_TYPE.DATA_TYPE_ID = SI.DATA_TYPE_REF) AS ITEM_TYPE,
      SI.IS_ARRAY AS ITEM_IS_ARRAY,
      SI.IS_ENUM AS ITEM_IS_ENUM,
      SI.MIN_LENGTH AS ITEM_MIN_LENGTH,
      SI.MAX_LENGTH AS ITEM_MAX_LENGTH,
      SI.IS_WRITABLE AS ITEM_IS_WRITABLE,
      SI.IS_NULLABLE AS ITEM_IS_NULLABLE,
      SI.IS_OPTIONAL AS ITEM_IS_OPTIONAL,
      SI.IS_FABRIC_SENSITIVE AS ITEM_IS_FABRIC_SENSITIVE,
      SI.DATA_TYPE_REF AS ITEM_DATA_TYPE_REF
    FROM
      STRUCT AS S
    INNER JOIN
      DATA_TYPE AS DT
    ON
      S.STRUCT_ID = DT.DATA_TYPE_ID
    LEFT JOIN
      STRUCT_ITEM AS SI
    ON
      S.STRUCT_ID = SI.STRUCT_REF
    WHERE
      DT.PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
    ORDER BY DT.NAME, DT.DATA_TYPE_ID, SI.FIELD_IDENTIFIER`
  } else {
    query = `
    SELECT
      S.STRUCT_ID AS STRUCT_ID,
      S.IS_FABRIC_SCOPED AS IS_FABRIC_SCOPED,
      S.API_MATURITY AS API_MATURITY,
      DT.NAME AS STRUCT_NAME,
      (SELECT COUNT(1) FROM DATA_TYPE_CLUSTER WHERE DATA_TYPE_CLUSTER.DATA_TYPE_REF = S.STRUCT_ID) AS STRUCT_CLUSTER_COUNT,
      SI.NAME AS ITEM_NAME,
      SI.FIELD_IDENTIFIER AS ITEM_IDENTIFIER,
      (SELECT DATA_TYPE.NAME FROM DATA_TYPE WHERE DATA_TYPE.DATA_TYPE_ID = SI.DATA_TYPE_REF) AS ITEM_TYPE,
      SI.IS_ARRAY AS ITEM_IS_ARRAY,
      SI.IS_ENUM AS ITEM_IS_ENUM,
      SI.MIN_LENGTH AS ITEM_MIN_LENGTH,
      SI.MAX_LENGTH AS ITEM_MAX_LENGTH,
      SI.IS_WRITABLE AS ITEM_IS_WRITABLE,
      SI.IS_NULLABLE AS ITEM_IS_NULLABLE,
      SI.IS_OPTIONAL AS ITEM_IS_OPTIONAL,
      SI.IS_FABRIC_SENSITIVE AS ITEM_IS_FABRIC_SENSITIVE,
      SI.DATA_TYPE_REF AS ITEM_DATA_TYPE_REF
    FROM
      STRUCT AS S
    INNER JOIN
      DATA_TYPE AS DT
    ON
      S.STRUCT_ID = DT.DATA_TYPE_ID
    INNER JOIN
      DATA_TYPE_CLUSTER AS DTC
    ON
      DT.DATA_TYPE_ID = DTC.DATA_TYPE_REF
    LEFT JOIN
      STRUCT_ITEM AS SI
    ON
      S.STRUCT_ID = SI.STRUCT_REF
    WHERE
      DT.PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
    AND
      DTC.CLUSTER_REF = ?
    ORDER BY DT.NAME, DT.DATA_TYPE_ID, SI.FIELD_IDENTIFIER`
    args = [clusterId]
  }

  let rows = await dbApi.dbAll(db, query, args)
  return rows.reduce((acc, value) => {
    let objectToActOn
    if (acc.length == 0 || acc[acc.length - 1].struct_id != value.STRUCT_ID) {
      // Create a new object
      objectToActOn = {
        id: value.STRUCT_ID,
        name: value.STRUCT_NAME,
        struct_id: value.STRUCT_ID,
        isFabricScoped: dbApi.fromDbBool(value.IS_FABRIC_SCOPED),
        apiMaturity: value.API_MATURITY,
        label: value.STRUCT_NAME,
        struct_cluster_count: value.STRUCT_CLUSTER_COUNT,
        items: [],
        itemCnt: 0
      }
      acc.push(objectToActOn)
    } else {
      objectToActOn = acc[acc.length - 1]
    }
    objectToActOn.items.push({
      name: value.ITEM_NAME,
      label: value.ITEM_NAME,
      fieldIdentifier: value.ITEM_IDENTIFIER,
      type: value.ITEM_TYPE,
      isArray: dbApi.fromDbBool(value.ITEM_IS_ARRAY),
      isEnum: dbApi.fromDbBool(value.ITEM_IS_ENUM),
      minLength: value.ITEM_MIN_LENGTH,
      maxLength: value.ITEM_MAX_LENGTH,
      isWritable: dbApi.fromDbBool(value.ITEM_IS_WRITABLE),
      isNullable: dbApi.fromDbBool(value.ITEM_IS_NULLABLE),
      isOptional: dbApi.fromDbBool(value.ITEM_IS_OPTIONAL),
      isFabricSensitive: dbApi.fromDbBool(value.ITEM_IS_FABRIC_SENSITIVE),
      dataTypeReference: value.ITEM_DATA_TYPE_REF
    })
    objectToActOn.itemCnt++
    return acc
  }, [])
}

/**
 * Get struct item details from the given struct item ID.
 * @param {*} db
 * @param {*} id
 * @returns Promise of Stuct Items
 */
async function selectAllStructItemsById(db, id) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  STRUCT_ITEM.FIELD_IDENTIFIER,
  STRUCT_ITEM.NAME,
  DATA_TYPE.NAME AS TYPE,
  DISCRIMINATOR.NAME AS DISCRIMINATOR_NAME,
  STRUCT_ITEM.STRUCT_REF,
  STRUCT_ITEM.IS_ARRAY,
  STRUCT_ITEM.IS_ENUM,
  STRUCT_ITEM.MIN_LENGTH,
  STRUCT_ITEM.MAX_LENGTH,
  STRUCT_ITEM.DEFAULT_VALUE,
  STRUCT_ITEM.IS_WRITABLE,
  STRUCT_ITEM.IS_NULLABLE,
  STRUCT_ITEM.IS_OPTIONAL,
  STRUCT_ITEM.IS_FABRIC_SENSITIVE,
  STRUCT_ITEM.DATA_TYPE_REF
FROM
  STRUCT_ITEM
INNER JOIN
  DATA_TYPE
ON
  STRUCT_ITEM.DATA_TYPE_REF = DATA_TYPE.DATA_TYPE_ID
INNER JOIN
  DISCRIMINATOR
ON
  DATA_TYPE.DISCRIMINATOR_REF = DISCRIMINATOR.DISCRIMINATOR_ID
WHERE STRUCT_REF = ?
ORDER BY
  FIELD_IDENTIFIER`,
      [id]
    )
    .then((rows) => rows.map(dbMapping.map.structItem))
}

/**
 * Retrieves the struct items based on struct and cluster name.
 * Note: By default clusterName is null.
 *
 * @param  db
 * @param  name
 * @param  packageIds
 * @param  clusterName
 * @returns the details of the struct items
 */
async function selectAllStructItemsByStructName(
  db,
  name,
  packageIds,
  clusterName = null
) {
  let clusterCondition = clusterName
    ? `CLUSTER.NAME = "${clusterName}"`
    : `CLUSTER.NAME IS NULL`

  let structItemQuery = `
  SELECT
    SI.FIELD_IDENTIFIER,
    SI.NAME,
    (SELECT DATA_TYPE.NAME FROM DATA_TYPE WHERE DATA_TYPE.DATA_TYPE_ID = SI.DATA_TYPE_REF) AS TYPE,
    DT.NAME AS DATA_TYPE_REF_NAME,
    DISCRIMINATOR.NAME AS DISCRIMINATOR_NAME,
    SI.STRUCT_REF,
    SI.IS_ARRAY,
    SI.IS_ENUM,
    SI.MIN_LENGTH,
    SI.MAX_LENGTH,
    SI.IS_WRITABLE,
    SI.IS_NULLABLE,
    SI.IS_OPTIONAL,
    SI.IS_FABRIC_SENSITIVE,
    SI.DATA_TYPE_REF
  FROM
    STRUCT_ITEM AS SI
  INNER JOIN
    STRUCT
  ON
    STRUCT.STRUCT_ID = SI.STRUCT_REF
  INNER JOIN
    DATA_TYPE AS DT
  ON
    DT.DATA_TYPE_ID = STRUCT.STRUCT_ID
  LEFT JOIN
    DATA_TYPE_CLUSTER
  ON
    DATA_TYPE_CLUSTER.DATA_TYPE_REF = DT.DATA_TYPE_ID
  LEFT JOIN
    CLUSTER
  ON
    DATA_TYPE_CLUSTER.CLUSTER_REF = CLUSTER.CLUSTER_ID
  INNER JOIN
    DISCRIMINATOR
  ON
    DT.DISCRIMINATOR_REF = DISCRIMINATOR.DISCRIMINATOR_ID
  WHERE
    DT.NAME = ?
  AND
    DT.PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
  AND
    ${clusterCondition}
  ORDER BY FIELD_IDENTIFIER`

  let rows = []
  // Attempt to retrieve struct items with given cluster name
  if (clusterName) {
    rows = await dbApi.dbAll(db, structItemQuery, [name])
  }

  // If no rows were found then find a global struct by turning cluster name to null
  if (rows.length === 0) {
    structItemQuery = structItemQuery.replace(
      clusterCondition,
      `CLUSTER.NAME IS NULL`
    )
    rows = await dbApi.dbAll(db, structItemQuery, [name])
  }

  return rows.map(dbMapping.map.structItem)
}

/**
 * Retrieves all the clusters in the database.
 *
 * @export
 * @param {*} db
 * @returns Promise that resolves with the rows of clusters.
 */
async function selectAllClusters(db, packageId) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  CLUSTER_ID,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  DESCRIPTION,
  DEFINE,
  DOMAIN_NAME,
  IS_SINGLETON,
  REVISION,
  API_MATURITY,
  PACKAGE_REF
FROM CLUSTER
WHERE
  PACKAGE_REF = ?
ORDER BY CODE`,
      [packageId]
    )
    .then((rows) => rows.map(dbMapping.map.cluster))
}

/**
 * Finds cluster by code.
 *
 * @param {*} db
 * @param {*} packageId Single packageId or an array of them.
 * @param {*} clusterCode
 * @param {*} mfgCode
 * @returns cluster by code in a single package id.
 */
async function selectClusterByCode(db, packageId, clusterCode, mfgCode = null) {
  let query = `
SELECT
  CLUSTER_ID,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  DESCRIPTION,
  DEFINE,
  DOMAIN_NAME,
  IS_SINGLETON,
  REVISION,
  API_MATURITY
FROM
  CLUSTER
WHERE
  PACKAGE_REF = ?
  AND CODE = ?`

  let args
  if (mfgCode == null || mfgCode == 0) {
    query = query + ` AND MANUFACTURER_CODE IS NULL`
    args = [packageId, clusterCode]
  } else {
    query = query + ` AND MANUFACTURER_CODE = ?`
    args = [packageId, clusterCode, mfgCode]
  }
  return dbApi.dbGet(db, query, args).then(dbMapping.map.cluster)
}

/**
 * Returns a promise that resolves into a cluster.
 *
 * @param {*} db
 * @param {*} clusterId
 * @param {*} packageId
 * @returns promise that resolves into a cluster object
 */
async function selectClusterById(db, clusterId) {
  return dbApi
    .dbGet(
      db,
      `
SELECT
  CLUSTER_ID,
  PACKAGE_REF,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  DESCRIPTION,
  DEFINE,
  DOMAIN_NAME,
  IS_SINGLETON,
  REVISION
FROM
  CLUSTER
WHERE
  CLUSTER_ID = ?`,
      [clusterId]
    )
    .then(dbMapping.map.cluster)
}

/**
 * Returns attributes for a given cluster.
 * IMPORTANT:
 *    packageIds are needed to properly deal with the global attributes.
 *
 * This method will NOT only return the attributes that link to
 * a given cluster, but will ALSO return the attributes that have
 * empty clusterRef (which are global attributes), and the check
 * in that case will be made via packageId.
 *
 * @param {*} db
 * @param {*} clusterId
 * @param {*} packageIds
 * @returns promise of a list of attributes, including global attributes
 */
async function selectAttributesByClusterIdIncludingGlobal(
  db,
  clusterId,
  packageIds
) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  ATTRIBUTE_ID,
  CLUSTER_REF,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  TYPE,
  SIDE,
  DEFINE,
  CONFORMANCE,
  MIN,
  MAX,
  MIN_LENGTH,
  MAX_LENGTH,
  REPORT_MIN_INTERVAL,
  REPORT_MAX_INTERVAL,
  REPORTABLE_CHANGE,
  REPORTABLE_CHANGE_LENGTH,
  IS_WRITABLE,
  IS_READABLE,
  DEFAULT_VALUE,
  IS_OPTIONAL,
  REPORTING_POLICY,
  STORAGE_POLICY,
  IS_NULLABLE,
  IS_SCENE_REQUIRED,
  ARRAY_TYPE,
  MUST_USE_TIMED_WRITE,
  API_MATURITY,
  PACKAGE_REF,
 IS_CHANGE_OMITTED,
  PERSISTENCE
FROM ATTRIBUTE
WHERE (CLUSTER_REF = ? OR CLUSTER_REF IS NULL)
  AND PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
ORDER BY CODE`,
      [clusterId]
    )
    .then((rows) => rows.map(dbMapping.map.attribute))
}

/**
 * Get attribute details from the given information.
 *
 * @param {*} db
 * @param {*} clusterId
 * @param {*} packageIds
 * @param {*} side
 * @returns Promise of attribute details
 */
async function selectAttributesByClusterIdAndSideIncludingGlobal(
  db,
  clusterId,
  packageIds,
  side
) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  ATTRIBUTE_ID,
  CLUSTER_REF,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  TYPE,
  SIDE,
  DEFINE,
  MIN,
  MAX,
  MIN_LENGTH,
  MAX_LENGTH,
  REPORT_MIN_INTERVAL,
  REPORT_MAX_INTERVAL,
  REPORTABLE_CHANGE,
  REPORTABLE_CHANGE_LENGTH,
  IS_WRITABLE,
  IS_READABLE,
  DEFAULT_VALUE,
  IS_OPTIONAL,
  REPORTING_POLICY,
  STORAGE_POLICY,
  IS_NULLABLE,
  IS_SCENE_REQUIRED,
  ARRAY_TYPE,
  MUST_USE_TIMED_WRITE,
  API_MATURITY,
 IS_CHANGE_OMITTED,
  PERSISTENCE
FROM ATTRIBUTE
WHERE
  SIDE = ?
  AND (CLUSTER_REF = ? OR CLUSTER_REF IS NULL)
  AND PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
ORDER BY CODE`,
      [side, clusterId]
    )
    .then((rows) => rows.map(dbMapping.map.attribute))
}

/**
 * Queries for attributes inside a cluster.
 *
 * @param {*} db
 * @param {*} packageId
 * @param {*} clusterCode
 * @param {*} manufacturerCode
 * @returns promise that resolves into attributes.
 */
async function selectAttributesByClusterCodeAndManufacturerCode(
  db,
  packageId,
  clusterCode,
  manufacturerCode
) {
  let manufacturerString
  if (manufacturerCode == null) {
    manufacturerString = ' AND C.MANUFACTURER_CODE IS NULL'
  } else {
    manufacturerString =
      ' AND C.MANUFACTURER_CODE IS NULL OR C.MANUFACTURER_CODE = ' +
      manufacturerCode
  }
  return dbApi
    .dbAll(
      db,
      `
SELECT
  A.ATTRIBUTE_ID,
  A.CLUSTER_REF,
  A.CODE,
  A.MANUFACTURER_CODE,
  A.NAME,
  A.TYPE,
  A.SIDE,
  A.DEFINE,
  A.MIN,
  A.MAX,
  A.MIN_LENGTH,
  A.MAX_LENGTH,
  A.REPORT_MIN_INTERVAL,
  A.REPORT_MAX_INTERVAL,
  A.REPORTABLE_CHANGE,
  A.REPORTABLE_CHANGE_LENGTH,
  A.IS_WRITABLE,
  A.IS_READABLE,
  A.DEFAULT_VALUE,
  A.IS_OPTIONAL,
  A.REPORTING_POLICY,
  A.STORAGE_POLICY,
  A.IS_NULLABLE,
  A.IS_SCENE_REQUIRED,
  A.ARRAY_TYPE,
  A.MUST_USE_TIMED_WRITE,
  A.API_MATURITY,
  A.IS_CHANGE_OMITTED,
  A.PERSISTENCE
FROM
  ATTRIBUTE AS A,
  CLUSTER AS C
WHERE C.CODE = ?
  AND C.CLUSTER_ID = A.CLUSTER_REF
  AND A.PACKAGE_REF = ?
  ${manufacturerString}`,
      [clusterCode, packageId]
    )
    .then((rows) => rows.map(dbMapping.map.attribute))
}

/**
 * Get attribute details from the given attribute ID.
 *
 * @param {*} db
 * @param {*} id
 * @returns Promise of attribute
 */
async function selectAttributeById(db, id) {
  return dbApi
    .dbGet(
      db,
      `
SELECT
  ATTRIBUTE_ID,
  CLUSTER_REF,
  PACKAGE_REF,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  TYPE,
  SIDE,
  DEFINE,
  MIN,
  MAX,
  MIN_LENGTH,
  MAX_LENGTH,
  REPORT_MIN_INTERVAL,
  REPORT_MAX_INTERVAL,
  REPORTABLE_CHANGE,
  REPORTABLE_CHANGE_LENGTH,
  IS_WRITABLE,
  IS_READABLE,
  DEFAULT_VALUE,
  IS_OPTIONAL,
  REPORTING_POLICY,
  STORAGE_POLICY,
  IS_NULLABLE,
  IS_SCENE_REQUIRED,
  ARRAY_TYPE,
  MUST_USE_TIMED_WRITE,
  API_MATURITY,
 IS_CHANGE_OMITTED,
  PERSISTENCE
FROM ATTRIBUTE
WHERE ATTRIBUTE_ID = ?`,
      [id]
    )
    .then(dbMapping.map.attribute)
}
/**
 * This async function should be used when you want to get attributes, while also resolving against any global data that may be overridden by a particular cluster.
 * @param {*} db
 * @param {*} attributeId
 * @param {*} clusterRef
 */
async function selectAttributeByAttributeIdAndClusterRef(
  db,
  attributeId,
  clusterRef
) {
  return dbApi
    .dbGet(
      db,
      `
SELECT
  A.ATTRIBUTE_ID,
  A.PACKAGE_REF,
  A.CLUSTER_REF,
  A.CODE,
  A.MANUFACTURER_CODE,
  A.NAME,
  A.TYPE,
  A.SIDE,
  A.DEFINE,
  A.MIN,
  A.MAX,
  A.MIN_LENGTH,
  A.MAX_LENGTH,
  A.REPORT_MIN_INTERVAL,
  A.REPORT_MAX_INTERVAL,
  A.REPORTABLE_CHANGE,
  A.REPORTABLE_CHANGE_LENGTH,
  A.IS_WRITABLE,
  A.IS_READABLE,
  CASE
    WHEN A.CLUSTER_REF NOT NULL
    THEN A.DEFAULT_VALUE
  ELSE
    CASE
      WHEN
        EXISTS ( SELECT DEFAULT_VALUE
                 FROM GLOBAL_ATTRIBUTE_DEFAULT
                 WHERE CLUSTER_REF = ?
                   AND ATTRIBUTE_REF = ATTRIBUTE_ID )
      THEN ( SELECT DEFAULT_VALUE
             FROM GLOBAL_ATTRIBUTE_DEFAULT
             WHERE CLUSTER_REF = ?
               AND ATTRIBUTE_REF = ATTRIBUTE_ID)
    ELSE A.DEFAULT_VALUE
    END
  END AS DEFAULT_VALUE,
  A.IS_OPTIONAL,
  A.REPORTING_POLICY,
  A.STORAGE_POLICY,
  A.IS_NULLABLE,
  A.IS_SCENE_REQUIRED,
  A.ARRAY_TYPE,
  A.MUST_USE_TIMED_WRITE,
  A.API_MATURITY,
  A.IS_CHANGE_OMITTED,
  A.PERSISTENCE
FROM ATTRIBUTE AS A
WHERE ATTRIBUTE_ID = ?`,
      [clusterRef, clusterRef, attributeId]
    )
    .then(dbMapping.map.attribute)
}

/**
 * Get all attributes from the given package IDs.
 *
 * @param {*} db
 * @param {*} packageIds
 * @returns Promise of attributes
 */
async function selectAllAttributes(db, packageIds) {
  return dbApi
    .dbAll(
      db,
      `
SELECT
  A.ATTRIBUTE_ID,
  A.CLUSTER_REF,
  A.CODE,
  A.MANUFACTURER_CODE,
  A.NAME,
  A.TYPE,
  A.SIDE,
  A.DEFINE,
  A.CONFORMANCE,
  A.MIN,
  A.MAX,
  A.MIN_LENGTH,
  A.MAX_LENGTH,
  A.REPORT_MIN_INTERVAL,
  A.REPORT_MAX_INTERVAL,
  A.REPORTABLE_CHANGE,
  A.REPORTABLE_CHANGE_LENGTH,
  A.IS_WRITABLE,
  A.IS_READABLE,
  A.DEFAULT_VALUE,
  A.IS_OPTIONAL,
  A.REPORTING_POLICY,
  A.STORAGE_POLICY,
  A.IS_NULLABLE,
  A.IS_SCENE_REQUIRED,
  A.ARRAY_TYPE,
  A.MUST_USE_TIMED_WRITE,
  A.API_MATURITY,
  C.CODE AS CLUSTER_CODE,
  A.IS_CHANGE_OMITTED,
  A.PERSISTENCE
FROM
  ATTRIBUTE AS A
LEFT JOIN
  CLUSTER AS C
ON
  A.CLUSTER_REF = C.CLUSTER_ID
WHERE
  A.PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
ORDER BY
  C.CODE, A.CODE`,
      []
    )
    .then((rows) => rows.map(dbMapping.map.attribute))
}

/**
 * Query for attributes by side.
 *
 * @param {*} db
 * @param {*} side
 * @param {*} packageId
 * @returns promise that resolves into attributes.
 */
async function selectAllAttributesBySide(db, side, packageIds) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  ATTRIBUTE_ID,
  CLUSTER_REF,
  CODE,
  MANUFACTURER_CODE,
  NAME,
  TYPE,
  SIDE,
  DEFINE,
  MIN,
  MAX,
  MIN_LENGTH,
  MAX_LENGTH,
  REPORT_MIN_INTERVAL,
  REPORT_MAX_INTERVAL,
  REPORTABLE_CHANGE,
  REPORTABLE_CHANGE_LENGTH,
  IS_WRITABLE,
  IS_READABLE,
  DEFAULT_VALUE,
  IS_OPTIONAL,
  REPORTING_POLICY,
  STORAGE_POLICY,
  IS_NULLABLE,
  IS_SCENE_REQUIRED,
  ARRAY_TYPE,
  MUST_USE_TIMED_WRITE,
  API_MATURITY,
 IS_CHANGE_OMITTED,
  PERSISTENCE
FROM ATTRIBUTE
   WHERE SIDE = ?
   AND PACKAGE_REF IN (${dbApi.toInClause(packageIds)})
ORDER BY CODE`,
    [side]
  )
  return rows.map(dbMapping.map.attribute)
}

/**
 * Get the endpoint type cluster details from the given endpoint type ID.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns Promise of endpoint type clusters.
 */
async function selectEndpointTypeClustersByEndpointTypeId(db, endpointTypeId) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  ENDPOINT_TYPE_REF,
  CLUSTER_REF,
  SIDE,
  ENABLED,
  ENDPOINT_TYPE_CLUSTER_ID
FROM
  ENDPOINT_TYPE_CLUSTER
WHERE
  ENDPOINT_TYPE_REF = ?
ORDER BY
  CLUSTER_REF`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeCluster)
}

/**
 * Get the server-side endpoint type cluster ID from the given endpoint type ID and cluster reference.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @param {*} clusterRef
 * @param {*} clusterSide
 * @returns Promise of endpoint type cluster ID, or null if not found.
 */
async function selectEndpointTypeClusterIdByEndpointTypeIdAndClusterRefAndSide(
  db,
  endpointTypeId,
  clusterRef,
  clusterSide
) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  ENDPOINT_TYPE_CLUSTER_ID,
  ENDPOINT_TYPE_REF,
  CLUSTER_REF,
  SIDE,
  ENABLED
FROM
  ENDPOINT_TYPE_CLUSTER
WHERE
  ENDPOINT_TYPE_REF = ?
  AND CLUSTER_REF = ?
  AND SIDE = ?
  `,
    [endpointTypeId, clusterRef, clusterSide]
  )
  let mapped = rows.map(dbMapping.map.endpointTypeCluster)
  return mapped.length > 0 ? mapped[0].endpointTypeClusterId : null
}

/**
 * Get the endpoint type attribute details from the given endpoint type ID.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns Promise of endpoint type attributes.
 */
async function selectEndpointTypeAttributesByEndpointId(db, endpointTypeId) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  ETC.ENDPOINT_TYPE_REF,
  ETC.CLUSTER_REF,
  ETA.ATTRIBUTE_REF,
  ETA.INCLUDED,
  ETA.STORAGE_OPTION,
  ETA.SINGLETON,
  ETA.BOUNDED,
  ETA.DEFAULT_VALUE,
  ETA.INCLUDED_REPORTABLE,
  ETA.MIN_INTERVAL,
  ETA.MAX_INTERVAL,
  ETA.REPORTABLE_CHANGE
FROM
  ENDPOINT_TYPE_ATTRIBUTE AS ETA,
  ENDPOINT_TYPE_CLUSTER AS ETC
WHERE
  ETC.ENDPOINT_TYPE_REF = ?
  AND ETA.ENDPOINT_TYPE_CLUSTER_REF = ETC.ENDPOINT_TYPE_CLUSTER_ID
ORDER BY ATTRIBUTE_REF`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeAttribute)
}

/**
 * Get the endpoint type attribute details from the given details.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @param {*} attributeRef
 * @param {*} clusterRef
 * @returns Promise of endpoint type attribute.
 */
async function selectEndpointTypeAttribute(
  db,
  endpointTypeId,
  attributeRef,
  clusterRef
) {
  let row = await dbApi.dbGet(
    db,
    `
SELECT
  ETC.ENDPOINT_TYPE_REF,
  ETC.CLUSTER_REF,
  ETA.ATTRIBUTE_REF,
  ETA.ENDPOINT_TYPE_ATTRIBUTE_ID,
  ETA.INCLUDED,
  ETA.STORAGE_OPTION,
  ETA.SINGLETON,
  ETA.BOUNDED,
  ETA.DEFAULT_VALUE,
  ETA.INCLUDED_REPORTABLE,
  ETA.MIN_INTERVAL,
  ETA.MAX_INTERVAL,
  ETA.REPORTABLE_CHANGE
FROM
  ENDPOINT_TYPE_ATTRIBUTE AS ETA,
  ENDPOINT_TYPE_CLUSTER AS ETC
WHERE
  ETC.ENDPOINT_TYPE_REF = ?
  AND ETA.ATTRIBUTE_REF = ?
  AND ETA.ENDPOINT_TYPE_CLUSTER_REF = ETC.ENDPOINT_TYPE_CLUSTER_ID
  AND ETC.CLUSTER_REF = ?`,
    [endpointTypeId, attributeRef, clusterRef]
  )
  return dbMapping.map.endpointTypeAttribute(row)
}

/**
 * Get the endpoint type command details from the given endpoint type ID.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns Promise of endpoint type commands
 */
async function selectEndpointTypeCommandsByEndpointId(db, endpointTypeId) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT * FROM (
SELECT
  ETC.ENDPOINT_TYPE_REF,
  ETC.CLUSTER_REF,
  ETCO.COMMAND_REF,
  CASE
    WHEN
      (COUNT(CASE WHEN ETCO.IS_INCOMING=1 AND ETCO.IS_ENABLED THEN 1 ELSE NULL END) OVER (PARTITION BY ETCO.COMMAND_REF)) >= 1
    THEN
      1
    ELSE
      0
  END AS INCOMING,
  CASE
    WHEN
    (COUNT(CASE WHEN ETCO.IS_INCOMING=0 AND ETCO.IS_ENABLED THEN 1 ELSE NULL END) OVER (PARTITION BY ETCO.COMMAND_REF)) >= 1
    THEN
      1
    ELSE
      0
  END AS OUTGOING
FROM
  ENDPOINT_TYPE_COMMAND AS ETCO,
  ENDPOINT_TYPE_CLUSTER AS ETC
WHERE
  ETC.ENDPOINT_TYPE_REF = ?
  AND ETCO.ENDPOINT_TYPE_CLUSTER_REF = ETC.ENDPOINT_TYPE_CLUSTER_ID)
GROUP BY
  CLUSTER_REF, COMMAND_REF
ORDER BY
  COMMAND_REF`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeCommand)
}

/**
 * Get endpoint type events from the given endpoint type ID.
 *
 * @param {*} db
 * @param {*} endpointTypeId
 * @returns Promise of endpoint type events
 */
async function selectEndpointTypeEventsByEndpointId(db, endpointTypeId) {
  let rows = await dbApi.dbAll(
    db,
    `
SELECT
  ETC.ENDPOINT_TYPE_REF,
  ETC.CLUSTER_REF,
  ETE.EVENT_REF,
  ETE.INCLUDED
FROM
  ENDPOINT_TYPE_EVENT AS ETE,
  ENDPOINT_TYPE_CLUSTER AS ETC
WHERE
  ETC.ENDPOINT_TYPE_REF = ?
  AND ETE.ENDPOINT_TYPE_CLUSTER_REF = ETC.ENDPOINT_TYPE_CLUSTER_ID
ORDER BY
  EVENT_REF`,
    [endpointTypeId]
  )
  return rows.map(dbMapping.map.endpointTypeEvent)
}

//exports
exports.selectClusterBitmaps = selectClusterBitmaps
exports.selectAllBitmapFields = selectAllBitmapFields
exports.selectAllBitmapFieldsById = selectAllBitmapFieldsById

exports.selectAllDomains = selectAllDomains
exports.selectDomainById = selectDomainById

exports.selectAllStructsWithItemCount = selectAllStructsWithItemCount
exports.selectAllStructsWithItems = selectAllStructsWithItems
exports.selectClusterStructsWithItems = selectClusterStructsWithItems

exports.selectAllStructItemsById = selectAllStructItemsById
exports.selectAllStructItemsByStructName = selectAllStructItemsByStructName

exports.selectAllClusters = selectAllClusters
exports.selectClusterById = selectClusterById
exports.selectClusterByCode = selectClusterByCode

exports.selectAttributesByClusterIdAndSideIncludingGlobal =
  selectAttributesByClusterIdAndSideIncludingGlobal
exports.selectAttributesByClusterIdIncludingGlobal =
  selectAttributesByClusterIdIncludingGlobal
exports.selectAttributesByClusterCodeAndManufacturerCode =
  selectAttributesByClusterCodeAndManufacturerCode
exports.selectAttributeById = selectAttributeById
exports.selectAttributeByAttributeIdAndClusterRef =
  selectAttributeByAttributeIdAndClusterRef
exports.selectAllAttributes = selectAllAttributes
exports.selectAllAttributesBySide = selectAllAttributesBySide

exports.selectEndpointTypeClustersByEndpointTypeId =
  selectEndpointTypeClustersByEndpointTypeId
exports.selectEndpointTypeClusterIdByEndpointTypeIdAndClusterRefAndSide =
  selectEndpointTypeClusterIdByEndpointTypeIdAndClusterRefAndSide
exports.selectEndpointTypeAttributesByEndpointId =
  selectEndpointTypeAttributesByEndpointId
exports.selectEndpointTypeAttribute = selectEndpointTypeAttribute
exports.selectEndpointTypeCommandsByEndpointId =
  selectEndpointTypeCommandsByEndpointId
exports.selectEndpointTypeEventsByEndpointId =
  selectEndpointTypeEventsByEndpointId
exports.selectEnumClusters = selectEnumClusters
exports.selectStructClusters = selectStructClusters
exports.selectBitmapClusters = selectBitmapClusters

// Forwarded exports so we don't break API.
exports.selectAllAtomics = queryAtomic.selectAllAtomics
exports.selectAtomicType = queryAtomic.selectAtomicType
exports.selectAtomicById = queryAtomic.selectAtomicById

exports.selectAllEnums = queryEnum.selectAllEnums
exports.selectClusterEnums = queryEnum.selectClusterEnums
exports.selectAllEnumItemsById = queryEnum.selectAllEnumItemsById
exports.selectAllEnumItems = queryEnum.selectAllEnumItems
exports.selectEnumById = queryEnum.selectEnumById
exports.selectEnumByName = queryEnum.selectEnumByName
exports.selectEnumByNameAndClusterId = queryEnum.selectEnumByNameAndClusterId

exports.selectStructById = queryStruct.selectStructById
exports.selectStructByName = queryStruct.selectStructByName
exports.selectStructByNameAndClusterId =
  queryStruct.selectStructByNameAndClusterId
exports.selectStructByNameAndClusterName =
  queryStruct.selectStructByNameAndClusterName
exports.selectEnumByNameAndClusterName =
  queryEnum.selectEnumByNameAndClusterName
exports.selectBitmapByNameAndClusterName =
  queryBitmap.selectBitmapByNameAndClusterName

exports.selectBitmapById = queryBitmap.selectBitmapById
exports.selectAllBitmaps = queryBitmap.selectAllBitmaps
exports.selectBitmapByName = queryBitmap.selectBitmapByName
exports.selectBitmapByNameAndClusterId =
  queryBitmap.selectBitmapByNameAndClusterId

exports.selectDataTypeById = queryDataType.selectDataTypeById
exports.selectDataTypeByName = queryDataType.selectDataTypeByName
exports.selectDataTypeByNameAndClusterId =
  queryDataType.selectDataTypeByNameAndClusterId

exports.selectNumberByName = queryNumber.selectNumberByName
exports.selectNumberByNameAndClusterId =
  queryNumber.selectNumberByNameAndClusterId

exports.selectAllDiscriminators = queryDiscriminator.selectAllDiscriminators
exports.selectAllDataTypes = queryDataType.selectAllDataTypes
exports.selectAllNumbers = queryNumber.selectAllNumbers
exports.selectAllStrings = queryString.selectAllStrings
exports.selectSizeFromType = queryDataType.selectSizeFromType
exports.selectStringById = queryString.selectStringById
exports.selectStringByName = queryString.selectStringByName
exports.selectNumberById = queryNumber.selectNumberById
exports.selectStructsWithClusterAssociation =
  queryStruct.selectStructsWithClusterAssociation
