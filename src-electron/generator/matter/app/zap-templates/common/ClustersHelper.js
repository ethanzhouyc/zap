/*
 *
 *    Copyright (c) 2021 Project CHIP Authors
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

// Import helpers from zap core
const queryCommand = require('../../../../../db/query-command');
const queryEndpoint = require('../../../../../db/query-endpoint');
const queryEndpointType = require('../../../../../db/query-endpoint-type');
const queryEvent = require('../../../../../db/query-event');
const templateUtil = require('../../../../../generator/template-util');
const zclHelper = require('../../../../../generator/helper-zcl');
const zclQuery = require('../../../../../db/query-zcl');

const { Deferred } = require('./Deferred');
const ListHelper = require('./ListHelper');
const StringHelper = require('./StringHelper');
const ChipTypesHelper = require('./ChipTypesHelper');
const dbEnum = require('../../../../../../src-shared/db-enum');

// Helper for better error reporting.
function ensureState(condition, error) {
  if (!condition) {
    let err = new Error(error);
    console.log(`${error}: ` + err.stack);
    throw err;
  }
}

//
// Load Step 1
//
function loadAtomics(packageIds) {
  const { db, sessionId } = this.global;
  const options = { hash: {} };

  const resolveZclTypes = (atomics) =>
    Promise.all(
      atomics.map((atomic) => {
        return zclHelper.asUnderlyingZclType
          .call(this, atomic.name, options)
          .then((zclType) => {
            atomic.chipType = zclType;
            return atomic;
          });
      })
    );

  return zclQuery.selectAllAtomics(db, packageIds).then(resolveZclTypes);
}

function loadBitmaps(packageIds) {
  const { db, sessionId } = this.global;
  return Promise.all(
    packageIds.map((packageId) => zclQuery.selectAllBitmaps(db, packageId))
  ).then((x) => x.flat());
}

function loadEnums(packageIds) {
  const { db, sessionId } = this.global;
  return Promise.all(
    packageIds.map((packageId) => zclQuery.selectAllEnums(db, packageId))
  ).then((x) => x.flat());
}

function loadStructItems(struct) {
  const { db, sessionId } = this.global;
  return zclQuery
    .selectAllStructItemsById(db, struct.id)
    .then((structItems) => {
      struct.items = structItems;
      return struct;
    });
}

function loadStructs(packageIds) {
  const { db, sessionId } = this.global;
  return zclQuery
    .selectAllStructsWithItemCount(db, packageIds)
    .then((structs) =>
      Promise.all(structs.map((struct) => loadStructItems.call(this, struct)))
    );
}

/**
 * Loads endpoint data, specifically what endpoints are available and what clusters
 * are defined within those endpoints.
 */
async function loadEndpoints() {
  let result = [];

  const { db, sessionId } = this.global;

  const endpoints = await queryEndpoint.selectAllEndpoints(db, sessionId);

  // Selection is one by one since existing API does not seem to provide
  // linkage between cluster and what endpoint it belongs to.
  //
  // TODO: there should be a better way
  for (const endpoint of endpoints) {
    const endpointClusters =
      await queryEndpointType.selectAllClustersDetailsFromEndpointTypes(db, [
        { endpointTypeId: endpoint.endpointTypeRef }
      ]);
    result.push({
      ...endpoint,
      clusters: endpointClusters.filter((c) => c.enabled == 1)
    });
  }

  return result;
}

async function loadAllClusters(packageId) {
  const { db, sessionId } = this.global;

  let allClusters = await zclQuery.selectAllClusters(db, packageId);
  // To match what loadClusters does, sort by cluster name (not cluster code).
  allClusters.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name == b.name) {
      return 0;
    }
    return 1;
  });
  let serverClusters = allClusters.map((cluster) => ({
    ...cluster,
    side: 'server',
    enabled: true
  }));
  let clientClusters = allClusters.map((cluster) => ({
    ...cluster,
    side: 'client',
    enabled: true
  }));
  return serverClusters.concat(clientClusters);
}

async function loadClusters() {
  const { db, sessionId } = this.global;

  const endpointTypes = await queryEndpointType.selectEndpointTypeIds(
    db,
    sessionId
  );
  const clusters =
    await queryEndpointType.selectAllClustersDetailsFromEndpointTypes(
      db,
      endpointTypes
    );

  return clusters.filter((cluster) => cluster.enabled == 1);
}

function loadCommandResponse(command) {
  const { db, sessionId } = this.global;
  return queryCommand
    .selectCommandById(db, command.id)
    .then((commandDetails) => {
      if (commandDetails.responseRef == null) {
        command.response = null;
        return command;
      }

      return queryCommand
        .selectCommandById(db, commandDetails.responseRef)
        .then((response) => {
          command.response = response;
          return command;
        });
    });
}

function loadCommandArguments(command) {
  const { db, sessionId } = this.global;
  return queryCommand
    .selectCommandArgumentsByCommandId(db, command.id)
    .then((commandArguments) => {
      command.arguments = commandArguments;
      return command;
    });
}

async function loadAllCommands(packageIds) {
  const { db, sessionId } = this.global;
  let cmds = await queryCommand.selectAllCommandsWithClusterInfo(db, [
    packageIds
  ]);
  // For each command, include it twice: once as outgoing for its source, once
  // as incoming for its destination.
  let outgoing = cmds.map((cmd) => ({
    ...cmd,
    incoming: false,
    outgoing: true,
    clusterSide: cmd.source
  }));
  let incoming = cmds.map((cmd) => ({
    ...cmd,
    incoming: true,
    outgoing: false,
    clusterSide: cmd.source == 'server' ? 'client' : 'server'
  }));
  let commands = Promise.resolve(outgoing.concat(incoming));
  return loadCommandsCommon.call(this, commands);
}

function loadCommands(packageIds) {
  const { db, sessionId } = this.global;
  let cmds = queryEndpointType
    .selectEndpointTypeIds(db, sessionId)
    .then((endpointTypes) =>
      queryEndpointType.selectClustersAndEndpointDetailsFromEndpointTypes(
        db,
        endpointTypes
      )
    )
    .then((endpointTypesAndClusters) =>
      queryCommand.selectCommandDetailsFromAllEndpointTypesAndClusters(
        db,
        endpointTypesAndClusters,
        true,
        packageIds
      )
    );

  return loadCommandsCommon.call(this, cmds);
}

// commandsPromise is a promise for an array of commands.
function loadCommandsCommon(commandsPromise) {
  return commandsPromise
    .then((commands) =>
      Promise.all(
        commands.map((command) => loadCommandResponse.call(this, command))
      )
    )
    .then((commands) =>
      Promise.all(
        commands.map((command) => loadCommandArguments.call(this, command))
      )
    );
}

async function loadAllAttributes(packageIds) {
  // The 'server' side is enforced here, because the list of attributes is used to generate client global
  // commands to retrieve server side attributes.
  const { db, sessionId } = this.global;
  let attrs = await zclQuery.selectAllAttributesBySide(db, 'server', [
    packageIds
  ]);
  const globalAttrs = attrs.filter((attr) => attr.clusterRef == null);
  // Exclude global attributes for now, since we will add them ourselves for
  // all clusters.
  attrs = attrs.filter((attr) => attr.clusterRef != null);
  // selectAllAttributesBySide sets clusterRef, not clusterId, so manually
  // set the latter here.
  attrs.forEach((attr) => (attr.clusterId = attr.clusterRef));

  const clusters = await Promise.all(
    packageIds.map((packageId) =>
      zclQuery.selectAllClusters(this.global.db, packageId)
    )
  ).then((cls) => cls.flat());

  for (let cluster of clusters) {
    for (let globalAttr of globalAttrs) {
      attrs.push({ ...globalAttr, clusterId: cluster.id });
    }
  }
  // selectAllAttributesBySide includes optionality information, which we
  // don't want here, because the types of the attributes are not in fact
  // optionals for our purposes.
  attrs.forEach((attr) => delete attr.isOptional);
  // Treat all attributes that could be reportable as reportable.
  attrs.forEach((attr) => {
    if (attr.isReportable) {
      attr.includedReportable = true;
    }
  });
  return attrs.sort((a, b) => a.code - b.code);
}

function loadAttributes() {
  // The 'server' side is enforced here, because the list of attributes is used to generate client global
  // commands to retrieve server side attributes.
  const { db, sessionId } = this.global;
  return queryEndpointType
    .selectEndpointTypeIds(db, sessionId)
    .then((endpointTypes) =>
      Promise.all(
        endpointTypes.map(({ endpointTypeId }) =>
          queryEndpoint.selectEndpointClusters(db, endpointTypeId)
        )
      )
    )
    .then((clusters) => clusters.flat())
    .then((clusters) =>
      Promise.all(
        clusters.map(({ clusterId, side, endpointTypeId }) =>
          queryEndpoint.selectEndpointClusterAttributes(
            db,
            clusterId,
            'server',
            endpointTypeId
          )
        )
      )
    )
    .then((attributes) => attributes.flat())
    .then((attributes) =>
      attributes.filter((attribute) => attribute.isIncluded)
    )
    .then((attributes) => attributes.sort((a, b) => a.code - b.code));
  //.then(attributes => Promise.all(attributes.map(attribute => types.typeSizeAttribute(db, packageId, attribute))
}

async function loadAllEvents(packageIds) {
  const { db, sessionId } = this.global;
  let clusters = await Promise.all(
    packageIds.map((packageId) => zclQuery.selectAllClusters(db, packageId))
  ).then((cls) => cls.flat());
  return loadEventsCommon.call(this, packageIds, clusters);
}

async function loadEvents(packageIds) {
  const { db, sessionId } = this.global;
  let clusters = await queryEndpointType
    .selectEndpointTypeIds(db, sessionId)
    .then((endpointTypes) =>
      Promise.all(
        endpointTypes.map(({ endpointTypeId }) =>
          queryEndpoint.selectEndpointClusters(db, endpointTypeId)
        )
      )
    )
    .then((clusters) => clusters.flat(3));
  return loadEventsCommon.call(this, packageIds, clusters);
}

// clusters is an array of clusters (not a promise).
function loadEventsCommon(packageIds, clusters) {
  const { db, sessionId } = this.global;
  return queryEvent.selectAllEvents(db, packageIds).then((events) => {
    events.forEach((event) => {
      const cluster = clusters.find(
        (cluster) => cluster.code == event.clusterCode
      );
      if (cluster) {
        event.clusterId = cluster.clusterId;
        event.clusterName = cluster.name;
      }
    });
    return events.filter((event) =>
      clusters.find((cluster) => cluster.code == event.clusterCode)
    );
  });
}

function loadGlobalAttributes(packageIds) {
  const { db, sessionId } = this.global;
  return zclQuery
    .selectAllAttributes(db, packageIds)
    .then((attributes) =>
      attributes.filter((attribute) => attribute.clusterRef == null)
    )
    .then((attributes) => attributes.map((attribute) => attribute.code));
}

//
// Load step 2
//

function asChipCallback(item) {
  if (StringHelper.isOctetString(item.type)) {
    return { name: 'OctetString', type: 'const chip::ByteSpan' };
  }

  if (StringHelper.isCharString(item.type)) {
    return { name: 'CharString', type: 'const chip::CharSpan' };
  }

  if (item.isArray) {
    return { name: 'List', type: null };
  }

  const basicType = ChipTypesHelper.asBasicType(item.chipType);
  switch (basicType) {
    case 'int8_t':
    case 'int16_t':
    case 'int32_t':
    case 'int64_t':
      return {
        name: 'Int' + basicType.replace(/[^0-9]/g, '') + 's',
        type: basicType
      };
    case 'uint8_t':
    case 'uint16_t':
    case 'uint32_t':
    case 'uint64_t':
      return {
        name: 'Int' + basicType.replace(/[^0-9]/g, '') + 'u',
        type: basicType
      };
    case 'bool':
      return { name: 'Boolean', type: 'bool' };
    case 'float':
      return { name: 'Float', type: 'float' };
    case 'double':
      return { name: 'Double', type: 'double' };
    default:
      return { name: 'Unsupported', type: null };
  }
}

function getAtomic(atomics, type) {
  return atomics.find(
    (atomic) => atomic.name.toLowerCase() == type.toLowerCase()
  );
}

function getBitmap(bitmaps, type) {
  return bitmaps.find((bitmap) => bitmap.label == type);
}

function getEnum(enums, type) {
  return enums.find((enumItem) => enumItem.label == type);
}

function getStruct(structs, type) {
  return structs.find((struct) => struct.label == type);
}

function handleString(item, [atomics, enums, bitmaps, structs]) {
  if (!StringHelper.isString(item.type)) {
    return false;
  }

  const atomic = getAtomic(atomics, item.type);
  if (!atomic) {
    return false;
  }

  const kLengthSizeInBytes = 2;

  item.atomicTypeId = atomic.atomicId;
  if (StringHelper.isOctetString(item.type)) {
    item.chipType = 'chip::ByteSpan';
  } else {
    item.chipType = 'chip::CharSpan';
  }
  item.size = kLengthSizeInBytes + item.maxLength;
  item.name = item.name || item.label;
  return true;
}

function handleList(item, [atomics, enums, bitmaps, structs]) {
  if (!ListHelper.isList(item.type)) {
    return false;
  }

  const entryType = item.entryType;
  if (!entryType) {
    console.log(item);
    throw new Error(item.label, 'List[T] is missing type "T" information');
  }

  item.isArray = true;
  item.type = entryType;
  enhancedItem(item, [atomics, enums, bitmaps, structs]);

  return true;
}

function handleStruct(item, [atomics, enums, bitmaps, structs]) {
  const struct = getStruct(structs, item.type);
  if (!struct) {
    return false;
  }

  // Add a leading `_` before the name of struct to match what is done in the af-structs.zapt template.
  // For instance structs are declared as "typedef struct _{{asType label}}".
  item.chipType = '_' + item.type;
  item.isStruct = true;

  struct.items.map((structItem) =>
    enhancedItem(structItem, [atomics, enums, bitmaps, structs])
  );
  item.items = struct.items;
  item.size = struct.items
    .map((type) => type.size)
    .reduce((accumulator, currentValue) => accumulator + currentValue, 0);
  return true;
}

function handleBasic(item, [atomics, enums, bitmaps, structs]) {
  let itemType = item.type;

  const enumItem = getEnum(enums, itemType);
  if (enumItem) {
    item.isEnum = true;
    itemType = 'enum' + enumItem.size * 8;
  }

  const bitmap = getBitmap(bitmaps, itemType);
  if (bitmap) {
    item.isBitmap = true;
    itemType = 'bitmap' + bitmap.size * 8;
  }

  const atomic = getAtomic(atomics, itemType);
  if (atomic) {
    item.name = item.name || item.label;
    item.isStruct = false;
    item.atomicTypeId = atomic.atomicId;
    item.size = atomic.size;
    item.chipType = atomic.chipType;
    return true;
  }

  return false;
}

function enhancedItem(item, types) {
  if (handleString(item, types)) {
    return;
  }

  if (handleList(item, types)) {
    return;
  }

  if (handleStruct(item, types)) {
    return;
  }

  if (handleBasic(item, types)) {
    return;
  }

  throw new Error(item.type + ' not found.');
}

function inlineStructItems(args) {
  const returnedArgs = [];
  args.forEach((argument) => {
    if (!argument.isStruct) {
      returnedArgs.push(argument);
      return;
    }

    argument.items.forEach((item) => {
      returnedArgs.push(item);
    });
  });

  return returnedArgs;
}

function enhancedCommands(commands, types) {
  commands.forEach((command) => {
    command.arguments.forEach((argument) => {
      enhancedItem(argument, types);
      argument.isComplex =
        argument.isList || argument.isStruct || argument.isArray;
    });
  });
  commands.forEach((command) => {
    // Flag things ending in "Response" so we can filter out unused responses,
    // but don't stomp on a true isResponse value if it's set already because
    // some other command had this one as its response.
    command.isResponse =
      command.isResponse || command.name.includes('Response');
    command.isManufacturerSpecificCommand = !!command.mfgCode;

    command.hasSpecificResponse = !!command.response;
    if (command.response) {
      const responseName = command.response.name;
      command.responseName = responseName;
      // The 'response' property contains the response returned by the `selectCommandById`
      // helper. But this one does not contains all the metadata informations added by
      // `enhancedItem`, so instead of using the one from ZAP, retrieve the enhanced version.
      const clusterName = command.clusterName;
      command.response = commands.find(
        (command) =>
          command.name == responseName && command.clusterName == clusterName
      );
      // We might have failed to find a response if our configuration is weird
      // in some way.
      if (command.response) {
        command.response.isResponse = true;
      }
    } else {
      command.responseName = 'DefaultSuccess';
      command.response = { arguments: [] };
    }
  });

  // Filter unused responses
  commands = commands.filter((command) => {
    if (!command.isResponse) {
      return true;
    }

    const responseName = command.name;
    return commands.find((command) => command.responseName == responseName);
  });

  // At this stage, 'command.arguments' may contains 'struct'. But some controllers does not know (yet) how
  // to handle them. So those needs to be inlined.
  commands.forEach((command) => {
    if (command.isResponse) {
      return;
    }

    command.expandedArguments = inlineStructItems(command.arguments);
  });

  return commands;
}

function enhancedEvents(events, types) {
  events.forEach((event) => {
    const argument = {
      name: event.name,
      type: event.name,
      isArray: false,
      isEvent: true,
      isNullable: false,
      label: event.name
    };
    event.response = { arguments: [argument] };
  });
  return events;
}

function enhancedAttributes(attributes, globalAttributes, types) {
  attributes.forEach((attribute) => {
    enhancedItem(attribute, types);
    attribute.isGlobalAttribute = globalAttributes.includes(attribute.code);
    attribute.isWritableAttribute = !!attribute.isWritable;
    attribute.isReadableAttribute = !!attribute.isReadable;
    attribute.isReportableAttribute = !!attribute.includedReportable;
    attribute.chipCallback = asChipCallback(attribute);
    attribute.isComplex =
      attribute.isList || attribute.isStruct || attribute.isArray;
  });

  attributes.forEach((attribute) => {
    const argument = {
      name: attribute.name,
      type: attribute.type,
      size: attribute.size,
      isArray: attribute.isArray,
      isEvent: false,
      isNullable: attribute.isNullable,
      chipType: attribute.chipType,
      chipCallback: attribute.chipCallback,
      label: attribute.name
    };
    attribute.arguments = [argument];
    attribute.response = { arguments: [argument] };
  });

  // At this stage, the 'attributes' array contains all attributes enabled for all endpoints. It means
  // that a lot of attributes are duplicated if a cluster is enabled on multiple endpoints but that's
  // not what the templates expect. So let's deduplicate them.
  const compare = (a, b) =>
    a.name == b.name && a.clusterId == b.clusterId && a.side == b.side;
  return attributes.filter(
    (att, index) => attributes.findIndex((att2) => compare(att, att2)) == index
  );
}

const Clusters = {
  ready: new Deferred(),
  post_processing_ready: new Deferred()
};

class ClusterStructUsage {
  constructor() {
    this.usedStructures = new Map(); // Structure label -> structure
    this.clustersForStructure = new Map(); // Structure label -> Set(Cluster name)
    this.structuresForCluster = new Map(); // Cluster name -> Set(Structure label)
  }

  addUsedStructure(clusterName, structure) {
    // Record that generally this structure is used
    this.usedStructures.set(structure.label, structure);

    // Record that this structure is used by a
    // particular cluster name
    let clusterSet = this.clustersForStructure.get(structure.label);
    if (!clusterSet) {
      clusterSet = new Set();
      this.clustersForStructure.set(structure.label, clusterSet);
    }
    clusterSet.add(clusterName);

    let structureLabelSet = this.structuresForCluster.get(clusterName);
    if (!structureLabelSet) {
      structureLabelSet = new Set();
      this.structuresForCluster.set(clusterName, structureLabelSet);
    }
    structureLabelSet.add(structure.label);
  }

  /**
   * Finds structures that are specific to one cluster:
   *   - they belong to the cluster
   *   - only that cluster ever uses it
   */
  structuresSpecificToCluster(clusterName) {
    let clusterStructures = this.structuresForCluster.get(clusterName);
    if (!clusterStructures) {
      return [];
    }

    return Array.from(clusterStructures)
      .filter((name) => this.clustersForStructure.get(name).size == 1)
      .map((name) => this.usedStructures.get(name));
  }

  structuresUsedByMultipleClusters() {
    return Array.from(this.usedStructures.values()).filter(
      (s) => this.clustersForStructure.get(s.label).size > 1
    );
  }
}

Clusters._addUsedStructureNames = async function (
  clusterName,
  startType,
  allKnownStructs
) {
  const struct = getStruct(allKnownStructs, startType.type);
  if (!struct) {
    return;
  }

  this._cluster_structures.addUsedStructure(clusterName, struct);

  for (const item of struct.items) {
    this._addUsedStructureNames(clusterName, item, allKnownStructs);
  }
};

Clusters._computeUsedStructureNames = async function (structs) {
  // NOTE: this MUST be called only after attribute promise is resolved
  // as iteration of `get*ByClusterName` needs that data.
  for (const cluster of this._clusters) {
    const attributes = await this.getAttributesByClusterName(cluster.name);
    for (const attribute of attributes) {
      if (attribute.isStruct) {
        this._addUsedStructureNames(cluster.name, attribute, structs);
      }
    }

    const commands = await this.getCommandsByClusterName(cluster.name);
    for (const command of commands) {
      for (const argument of command.arguments) {
        this._addUsedStructureNames(cluster.name, argument, structs);
      }
    }

    const responses = await this.getResponsesByClusterName(cluster.name);
    for (const response of responses) {
      for (const argument of response.arguments) {
        this._addUsedStructureNames(cluster.name, argument, structs);
      }
    }
  }

  this._used_structure_names = new Set(
    this._cluster_structures.usedStructures.keys()
  );
};

/**
 * If includeAll is true, all events/commands/attributes will be included, not
 * just the ones enabled in the ZAP configuration.
 */
Clusters.init = async function (
  context,
  includeAllClusterConstructs,
  includeAllClusters
) {
  try {
    if (this.ready.running) {
      return this.ready;
    }
    this.ready.running = true;

    let packageIds = await templateUtil
      .ensureZclPackageIds(context)
      .catch((err) => {
        console.log(err);
        throw err;
      });

    const loadTypes = [
      loadAtomics.call(context, packageIds),
      loadEnums.call(context, packageIds),
      loadBitmaps.call(context, packageIds),
      loadStructs.call(context, packageIds)
    ];

    const promises = [
      Promise.all(loadTypes),
      loadEndpoints.call(context),
      includeAllClusters
        ? loadAllClusters.call(context, packageIds)
        : loadClusters.call(context),
      includeAllClusterConstructs
        ? loadAllCommands.call(context, packageIds)
        : loadCommands.call(context, packageIds),
      includeAllClusterConstructs
        ? loadAllAttributes.call(context, packageIds)
        : loadAttributes.call(context),
      loadGlobalAttributes.call(context, packageIds),
      (includeAllClusterConstructs ? loadAllEvents : loadEvents).call(
        context,
        packageIds
      )
    ];

    let [
      types,
      endpoints,
      clusters,
      commands,
      attributes,
      globalAttributes,
      events
    ] = await Promise.all(promises);

    this._endpoints = endpoints;
    this._clusters = clusters;
    this._commands = enhancedCommands(commands, types);
    this._attributes = enhancedAttributes(attributes, globalAttributes, types);
    this._events = enhancedEvents(events, types);
    this._cluster_structures = new ClusterStructUsage();

    // data is ready, but not full post - processing
    this.ready.resolve();

    await this._computeUsedStructureNames(types[3]);

    return this.post_processing_ready.resolve();
  } catch (err) {
    console.log(err);
    this.ready.resolve();
    throw err;
  }
};

//
// Helpers: All
//
function asBlocks(promise, options) {
  return promise.then((data) =>
    templateUtil.collectBlocks(data, options, this)
  );
}

function ensureClusters(
  context,
  includeAllClusterConstructs = false,
  includeAllClusters = false
) {
  // Kick off Clusters initialization.  This is async, but that's fine: all the
  // getters on Clusters wait on that initialziation to complete.
  ensureState(context, "Don't have a context");

  Clusters.init(context, includeAllClusterConstructs, includeAllClusters);
  return Clusters;
}

//
// Helpers: Get all clusters/commands/responses/attributes.
//
const kResponseFilter = (isResponse, item) => isResponse == item.isResponse;

Clusters.ensureReady = function () {
  ensureState(this.ready.running);
  return this.ready;
};

Clusters.ensurePostProcessingDone = function () {
  ensureState(this.ready.running);
  return this.post_processing_ready;
};

Clusters.getClusters = function () {
  return this.ensureReady().then(() => this._clusters);
};

Clusters.getEndPoints = function () {
  return this.ensureReady().then(() => this._endpoints);
};

Clusters.getCommands = function () {
  return this.ensureReady().then(() =>
    this._commands.filter(kResponseFilter.bind(null, false))
  );
};

Clusters.getResponses = function () {
  return this.ensureReady().then(() =>
    this._commands.filter(kResponseFilter.bind(null, true))
  );
};

Clusters.getAttributes = function () {
  return this.ensureReady().then(() => this._attributes);
};

Clusters.getEvents = function () {
  return this.ensureReady().then(() => this._events);
};

//
// Helpers: Get by Cluster Name
//
const kNameFilter = (name, item) =>
  name.toLowerCase() == (item.clusterName || item.name).toLowerCase();

Clusters.getCommandsByClusterName = function (name) {
  return this.getCommands().then((items) =>
    items.filter(kNameFilter.bind(null, name))
  );
};

Clusters.getResponsesByClusterName = function (name) {
  return this.getResponses().then((items) =>
    items.filter(kNameFilter.bind(null, name))
  );
};

Clusters.getAttributesByClusterName = function (name) {
  return this.ensureReady().then(() => {
    const clusterId = this._clusters.find(kNameFilter.bind(null, name)).id;
    const filter = (attribute) => attribute.clusterId == clusterId;
    return this.getAttributes().then((items) => items.filter(filter));
  });
};

Clusters.getEventsByClusterName = function (name) {
  return this.getEvents().then((items) =>
    items.filter(kNameFilter.bind(null, name))
  );
};

//
// Helpers: Get by Cluster Side
//
const kSideFilter = (side, item) =>
  item.source
    ? (item.source == side && item.outgoing) ||
      (item.source != side && item.incoming)
    : item.side == side;

Clusters.getCommandsByClusterSide = function (side) {
  return this.getCommands().then((items) =>
    items.filter(kSideFilter.bind(null, side))
  );
};

Clusters.getResponsesByClusterSide = function (side) {
  return this.getResponses().then((items) =>
    items.filter(kSideFilter.bind(null, side))
  );
};

Clusters.getAttributesByClusterSide = function (side) {
  return this.getAttributes().then((items) =>
    items.filter(kSideFilter.bind(null, side))
  );
};

Clusters.getEventsByClusterSide = function (side) {
  return this.getEvents().then((items) =>
    items.filter(kSideFilter.bind(null, side))
  );
};

//
// Helpers: Client
//
const kClientSideFilter = kSideFilter.bind(null, 'client');

Clusters.getClientClusters = function () {
  return this.getClusters().then((items) => items.filter(kClientSideFilter));
};

Clusters.getClientCommands = function (name) {
  return this.getCommandsByClusterName(name).then((items) =>
    items.filter(kClientSideFilter)
  );
};

Clusters.getClientResponses = function (name) {
  return this.getResponsesByClusterName(name).then((items) =>
    items.filter(kClientSideFilter)
  );
};

Clusters.getClientAttributes = function (name) {
  return this.getAttributesByClusterName(name).then((items) =>
    items.filter(kClientSideFilter)
  );
};

Clusters.getClientEvents = function (name) {
  return this.getEventsByClusterName(name).then((items) =>
    items.filter(kClientSideFilter)
  );
};

//
// Helpers: Server
//
const kServerSideFilter = kSideFilter.bind(null, 'server');

Clusters.getServerClusters = function () {
  return this.getClusters().then((items) => items.filter(kServerSideFilter));
};

Clusters.getServerCommands = function (name) {
  return this.getCommandsByClusterName(name).then((items) =>
    items.filter(kServerSideFilter)
  );
};

Clusters.getServerResponses = function (name) {
  return this.getResponsesByClusterName(name).then((items) =>
    items.filter(kServerSideFilter)
  );
};

Clusters.getServerAttributes = function (name) {
  return this.getAttributesByClusterName(name).then((items) =>
    items.filter(kServerSideFilter)
  );
};

Clusters.getUsedStructureNames = function () {
  return this.ensurePostProcessingDone().then(() => this._used_structure_names);
};

Clusters.getStructuresByClusterName = function (name) {
  return this.ensurePostProcessingDone().then(() =>
    this._cluster_structures.structuresSpecificToCluster(name)
  );
};

Clusters.getSharedStructs = function () {
  return this.ensurePostProcessingDone().then(() =>
    this._cluster_structures.structuresUsedByMultipleClusters()
  );
};

Clusters.getServerEvents = function (name) {
  return this.getEventsByClusterName(name).then((items) =>
    items.filter(kServerSideFilter)
  );
};

//
// Module exports
//
exports.asBlocks = asBlocks;
exports.ensureClusters = ensureClusters;
