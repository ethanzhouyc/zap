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

import * as Util from './util'
import * as DbEnum from '../../src-shared/db-enum'
import restApi from '../../src-shared/rest-api'
const http = require('http-status-codes')

/**
 * This module provides common computed properties used across various vue components
 */
export default {
  computed: {
    isZapConfigSelected: {
      get() {
        return this.$store.state.zap.selectedZapConfig !== null
      }
    },
    selectedEndpointTypeId: {
      get() {
        return this.$store.state.zap.endpointTypeView.selectedEndpointType
      }
    },
    endpointDeviceTypeRef: {
      get() {
        return this.$store.state.zap.endpointTypeView.deviceTypeRef
      }
    },
    deviceTypeClustersForSelectedEndpoint: {
      get() {
        return this.$store.state.zap.endpointTypeView
          .deviceTypeClustersForSelectedEndpoint
      }
    },
    endpointDeviceVersion: {
      get() {
        return this.$store.state.zap.endpointTypeView.deviceVersion
      }
    },
    selectedEndpointId: {
      get() {
        return this.$store.state.zap.endpointView.selectedEndpoint
      }
    },
    endpointIdListSorted: {
      get() {
        // return sorted endpoint (by endpoint id value, in ascending order) for display
        // parseInt is used as endpoint id value can be int or strings
        // NOTE: a Map is returned to maintain the order of the keys.
        //       coversion to an Object will reshuffle the entries.
        const endpointIds = new Map(
          Object.entries(this.$store.state.zap.endpointView.endpointId)
        )

        return new Map(
          [...endpointIds.entries()].sort((a, b) => {
            return parseInt(a[1], 16) - parseInt(b[1], 16)
          })
        )
      }
    },
    endpointId: {
      get() {
        return this.$store.state.zap.endpointView.endpointId
      }
    },
    endpointType: {
      get() {
        return this.$store.state.zap.endpointView.endpointType
      }
    },
    selectedCluster: {
      get() {
        return this.$store.state.zap.clustersView.selected[0] || {}
      }
    },
    selectedClusterId: {
      get() {
        return this.selectedCluster.id
      }
    },
    selectionClients: {
      get() {
        return this.$store.state.zap.clustersView.selectedClients
      }
    },
    selectionServers: {
      get() {
        return this.$store.state.zap.clustersView.selectedServers
      }
    },
    zclDeviceTypes: {
      get() {
        return this.$store.state.zap.zclDeviceTypes
      }
    },
    packages: {
      get() {
        return this.$store.state.zap.packages
      }
    },
    endpointTypeIdList: {
      get() {
        if (this.shareClusterStatesAcrossEndpoints()) {
          return Object.keys(this.endpointId)
        } else {
          return [this.selectedEndpointTypeId]
        }
      }
    },
    attributesRequiredByConform: {
      get() {
        return this.$store.state.zap.attributeView.mandatory
      }
    },
    attributesNotSupportedByConform: {
      get() {
        return this.$store.state.zap.attributeView.notSupported
      }
    },
    commandsRequiredByConform: {
      get() {
        return this.$store.state.zap.commandView.mandatory
      }
    },
    commandsNotSupportedByConform: {
      get() {
        return this.$store.state.zap.commandView.notSupported
      }
    },
    eventsRequiredByConform: {
      get() {
        return this.$store.state.zap.eventView.mandatory
      }
    },
    eventsNotSupportedByConform: {
      get() {
        return this.$store.state.zap.eventView.notSupported
      }
    }
  },
  methods: {
    getSmallestUnusedEndpointId() {
      let id = 1
      for (id; id < Object.values(this.endpointId).length + 1; id++) {
        if (
          _.isNil(
            _.find(
              Object.values(this.endpointId),
              (existingEndpointId) => id == existingEndpointId
            )
          )
        ) {
          return id
        }
      }
      return id
    },
    asHex(value, padding) {
      return Util.asHex(value, padding)
    },
    hashAttributeIdClusterId(attributeId, clusterId) {
      return Util.cantorPair(attributeId, clusterId)
    },
    getAttributeById(attributeId) {
      return this.$store.state.zap.attributes.find((a) => a.id == attributeId)
    },
    setSelectedEndpointType(endpointReference) {
      this.$store.dispatch('zap/updateSelectedEndpointType', {
        endpointType: this.endpointType[endpointReference],
        deviceTypeRef:
          this.endpointDeviceTypeRef[this.endpointType[endpointReference]]
      })
      this.$store.dispatch('zap/updateSelectedEndpoint', endpointReference)
      this.$store.dispatch('zap/updateClusters')
      let deviceTypeRefs = this.endpointDeviceTypeRef[this.selectedEndpointId]
      this.$store.dispatch('zap/setDeviceTypeFeatures', {
        deviceTypeRefs: deviceTypeRefs,
        endpointTypeRef: endpointReference
      })
      this.$store.dispatch(
        'zap/updateDeviceTypeClustersForSelectedEndpoint',
        deviceTypeRefs
      )
    },
    sdkExtClusterCode(extEntry) {
      return extEntry ? extEntry.entityCode : ''
    },
    sdkExtUcComponentId(extEntry) {
      return extEntry ? extEntry.value : ''
    },

    /**
     * Whether ZAP is running in standalone / Electron mode or not.
     * @returns
     */
    standaloneMode() {
      return this.$store.state.zap.standalone
    },

    /**
     * Whether ZAP is running in Zigbee mode to enforce rules when Cluster
     * are shared between 2 or more endpoints.
     */
    shareClusterStatesAcrossEndpoints() {
      let res = this.$store.state.zap.genericOptions?.generator?.filter(
        (x) =>
          x.optionCode ==
          DbEnum.generatorOptions.shareClusterStatesAcrossEndpoints
      )

      if (res?.length) {
        return res[0].optionLabel === 'true'
      } else {
        return false
      }
    },

    /**
     * While running in Studio / ZAP integration mode,
     * this flag determines whether disabling a ZCL cluster (server / client) triggers disabling of a
     * corresponding UC component. The disabling will only be issued if
     *
     * e.g.
     * If an SDK config has 1 endpoint, disabling a ZCL cluster will cause
     * the corresponding UC component to be disabled.
     *
     * If an SDK config has 2 or more endpoints, disabling the last enabled cluster
     * across all endpoints will trigger the corresponding UC component to be
     * disabled.
     */
    disableUcComponentOnZclClusterUpdate() {
      let res = this.$store.state.zap.genericOptions?.generator?.filter(
        (x) =>
          x.optionCode ==
          DbEnum.generatorOptions.disableUcComponentOnZclClusterUpdate
      )

      if (res?.length) {
        return res[0].optionLabel === 'true'
      } else {
        return false
      }
    },

    /**
     * Enable components by pinging backend, which pings Studio jetty server.
     * @param {*} params
     */
    updateSelectedComponentRequest(params) {
      if (!this.standaloneMode()) {
        this.$store
          .dispatch('zap/updateSelectedComponent', params)
          .then((response) => {
            if (response.status != http.StatusCodes.OK) {
              console.log('Failed to update selected components!')
            }
          })
      }
    },

    /**
     * Enable components by pinging backend, which pings Studio jetty server.
     * @param {*} params
     */
    missingUcComponentDependencies(cluster) {
      let requiredComponentIdList = []
      let roles = []
      let hasClient = this.selectionClients.includes(cluster.id)
      if (hasClient) {
        roles.push('client')
      }

      let hasServer = this.selectionServers.includes(cluster.id)
      if (hasServer) {
        roles.push('server')
      }

      for (const role of roles) {
        let components = this.ucComponentRequiredByCluster(cluster, role)
        requiredComponentIdList.push(
          ...components.map((c) => this.sdkExtUcComponentId(c))
        )
      }

      let selectedUcComponentIds = Util.getClusterIdsByUcComponents(
        this.$store.state.zap.studio.selectedUcComponents
      )

      return requiredComponentIdList.filter(
        (id) => !selectedUcComponentIds.includes(id)
      )
    },

    ucComponentRequiredByCluster(cluster, role) {
      let clusterRoleName = cluster.label.toLowerCase() + '-' + role
      return this.$store.state.zap.studio.zclSdkExtClusterToUcComponentMap.filter(
        (x) => this.sdkExtClusterCode(x) === clusterRoleName
      )
    },
    /**
     *  Specifies the path to the logo image
     *
     * @param {*} isTiny -
     *                   if value "true", it's used as a tiny logo
     *                   if value "false", it's used as a normal logo
     * @param {*} category -
     *                   if value "zigbee", it's used as a zigbee logo
     *                   if value "matter", it's used as a matter logo
     *                   if value "multiprotocol", it's used as a multiprotocol logo
     * @param {*} isSelected -
     *                   if value "true", it's used as a dark / selected version
     *                   if value "false", it's used as a light version
     * @returns Returns a string value for the src image property
     */
    createLogoSrc(isTiny, category, isSelected = false) {
      return (
        (isTiny ? '/logo/tiny/' : '/logo/') +
        (category ? category : 'default') +
        '_logo' +
        (isSelected || this.$q.dark.isActive ? '_white' : '') +
        '.svg'
      )
    },
    getLogos(selectedZapConfig) {
      let logos = []
      if (selectedZapConfig?.length) {
        for (let i = 0; i < selectedZapConfig.length; i++) {
          if (selectedZapConfig[i].category) {
            logos.push(
              this.createLogoSrc(
                this.$store.state.zap.isMultiConfig,
                selectedZapConfig[i].category
              )
            )
          } else {
            logos.push('/logo/zap_logo.png')
          }
        }
      } else {
        logos.push('/logo/zap_logo.png')
      }

      return logos
    },
    /**
     *  Calculate readable category
     *
     * @param {*} packageRef
     * @returns Returns a string value for category
     */
    getDeviceCategory(packageRef) {
      let zclProperty = ''
      if (this.$store.state.zap.isMultiConfig) {
        zclProperty =
          this.$store.state.zap.selectedZapConfig.zclProperties.find(
            (item) => item.id === packageRef && item.category
          )
        return zclProperty.category
      } else {
        zclProperty = this.$store.state.zap.packages.find(
          (item) => item.pkg.id === packageRef
        )
        return zclProperty.pkg?.category
      }
    },
    /**
     * When user toggles an element, set warning in the notification system
     * if the new state does not match its conformance,
     * and delete previous warning for this element if any.
     *
     * @param {*} element
     * @param {*} added
     * @param {*} elementType
     * @param {*} clusterRef
     */
    setRequiredElementNotifications(element, added, elementType) {
      let clusterName = this.selectedCluster.label
      let endpointId = this.endpointId[this.selectedEndpointId]
      let contextMessage =
        `⚠ Check Feature Compliance on endpoint: ${endpointId}, ` +
        `cluster: ${clusterName}, ${elementType.slice(0, -1)}: `
      let requiredText = this[`${elementType}RequiredByConform`][element.id]
      let notSupportedText =
        this[`${elementType}NotSupportedByConform`][element.id]

      this.$serverPost(restApi.uri.requiredElementWarning, {
        element: element,
        contextMessage: contextMessage,
        requiredText: requiredText,
        notSupportedText: notSupportedText,
        added: added
      })
    }
  }
}
