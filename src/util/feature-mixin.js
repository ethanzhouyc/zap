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

import restApi from '../../src-shared/rest-api'
import { Notify } from 'quasar'
// import editableAttributesMixin from './editable-attributes-mixin'
import commonMixin from '../util/common-mixin'
import * as dbEnum from '../../src-shared/db-enum'

export default {
  mixins: [commonMixin],
  computed: {
    // clusterFeatureData() {
    //   return this.$store.state.zap.features
    // },
    deviceTypeFeatures() {
      return this.$store.state.zap.featureView.deviceTypeFeatures
    },
    // deviceTypeFeatureInSelectedCluster() {
    //   return this.selectedClusterId
    //     ? this.deviceTypeFeatures.filter(
    //         (feature) => feature.clusterRef == this.selectedClusterId
    //       )
    //     : this.deviceTypeFeatures
    // },
    // featureMap() {
    //   return this.clusterFeatures.reduce((map, obj) => {
    //     map[obj.code] = this.enabledClusterFeatures.includes(obj.featureId)
    //       ? 1
    //       : 0
    //     return map
    //   }, {})
    // },
    featureMapAttribute() {
      return this.$store.state.zap.attributes.find(
        (attribute) =>
          attribute.name == dbEnum.featureMapAttribute.name &&
          attribute.code == dbEnum.featureMapAttribute.code
      )
    },
    featureMapValue() {
      return this.$store.state.zap.featureMapAttribute.value
    },
    featureMapAttributeId() {
      return this.$store.state.zap.featureMapAttribute.id
    },
    enabledDeviceTypeFeatures() {
      return this.$store.state.zap.featureView.enabledDeviceTypeFeatures
    },
    noElementsToUpdate() {
      return (
        this.attributesToUpdate.length == 0 &&
        this.commandsToUpdate.length == 0 &&
        this.eventsToUpdate.length == 0 &&
        this.featuresToUpdate.length == 0
      )
    },
    clusterFeatures() {
      return this.$store.state.zap.features
        .filter((feature) => {
          return this.individualClusterFilterString == ''
            ? true
            : feature.name
                .toLowerCase()
                .includes(this.individualClusterFilterString.toLowerCase())
        })
        .map((feature) => {
          // override feature conformance from device type features if available
          const matchingDeviceTypeFeature = this.deviceTypeFeatures.find(
            (deviceTypeFeature) =>
              deviceTypeFeature.featureId === feature.featureId &&
              deviceTypeFeature.clusterRef === feature.clusterRef
          )
          if (matchingDeviceTypeFeature) {
            feature.conformance = matchingDeviceTypeFeature.conformance
          }
          feature.cluster = this.selectedCluster
            ? this.selectedCluster.name
            : ''
          if (this.featureMapValue) {
            feature.featureMapValue = this.featureMapValue
            feature.featureMapAttributeId = this.featureMapAttributeId
          }
          return feature
        })
    },
    clusterFeatureConformance() {
      return this.clusterFeatures.reduce((map, feature) => {
        map[feature.code] = feature.conformance
        return map
      }, {})
    },
    enabledClusterFeatures() {
      return this.clusterFeatures
        .filter((feature) => {
          return this.getEnabledBitsFromFeatureMapValue(
            this.featureMapValue
          ).includes(feature.bit)
        })
        .map((feature) => feature.featureId)
    }
  },
  methods: {
    async onToggleDeviceTypeFeature(featureData, inclusionList, type) {
      featureData.type = type
      if (
        !this.selectedCluster ||
        Object.keys(this.selectedCluster).length == 0 ||
        this.selectedCluster.id !== featureData.clusterRef
      ) {
        let clusterData = this.getClusterDataByRef(featureData.clusterRef)

        await this.$store.dispatch('zap/updateSelectedCluster', clusterData)

        await this.loadFeatureMapAttribute(clusterData)
      }
      console.log('featuremapattributeid:', this.featureMapAttributeId)
      console.log('featuremapvalue:', this.featureMapValue)
      console.log('featureData in line 134:', featureData)
      //console.log('selectedCluster: ', this.selectedCluster)
      let featureMap = this.buildFeatureMap(inclusionList)
      console.log('featureMap:', featureMap)
      this.$serverPost(restApi.uri.checkConformOnFeatureUpdate, {
        featureData: featureData,
        featureMap: featureMap,
        featureConformance: this.clusterFeatureConformance,
        endpointId: this.endpointId[this.selectedEndpointId],
        endpointTypeId: this.selectedEndpointTypeId,
        changeConfirmed: false
      }).then((res) => {
        // store backend response and frontend data for reuse if updates are confirmed
        let {
          attributesToUpdate,
          commandsToUpdate,
          eventsToUpdate,
          featuresToUpdate,
          displayWarning,
          warningMessage,
          disableChange
        } = res.data
        Object.assign(this, {
          attributesToUpdate,
          commandsToUpdate,
          eventsToUpdate,
          displayWarning,
          warningMessage,
          disableChange
        })

        console.log('featuresToUpdate before parsing:', featuresToUpdate)

        this.featuresToUpdate = []
        Object.entries(featuresToUpdate).forEach(([code, value]) => {
          let feature = this.clusterFeatures.find((f) => f.code == code)
          if (feature) {
            feature.value = value
            this.featuresToUpdate.push(feature)
          }
        })

        console.log('featuresToUpdate after parsing:', this.featuresToUpdate)

        console.log('attributesToUpdate:', attributesToUpdate)

        this.selectedFeature = featureData
        this.updatedEnabledFeatures = inclusionList

        // if change disabled, display warning and do not show confirm dialog
        if (this.disableChange) {
          if (this.displayWarning) {
            this.displayPopUpWarnings(this.warningMessage)
          }
        } else if (this.noElementsToUpdate) {
          console.log('No elements to update, so no need to show the dialog.')
          this.confirmFeatureUpdate(featureData, inclusionList)
        } else {
          this.showDialog = true
        }
      })
    },
    async confirmFeatureUpdate(featureData, inclusionList) {
      let featureMap = {}
      if (this.featuresToUpdate.length > 0) {
        for (let feature of this.featuresToUpdate) {
          inclusionList.push(feature.featureId)
        }
        featureMap = this.buildFeatureMap(inclusionList)
        console.log(
          'requiredAttributes before:',
          this.attributesRequiredByConform
        )
        console.log(
          'notSupportedAttributes before:',
          this.attributesNotSupportedByConform
        )
        await this.$store.dispatch('zap/setRequiredElements', {
          featureMap: featureMap,
          featureData: featureData,
          endpointTypeId: this.selectedEndpointTypeId
        })
        console.log('requiredAttributes:', this.attributesRequiredByConform)
        console.log(
          'notSupportedAttributes:',
          this.attributesNotSupportedByConform
        )
      } else {
        featureMap = this.buildFeatureMap(inclusionList)
      }

      console.log('featureMap:', featureMap)

      // .then(() => {
      // toggle attributes, commands, and events for correct conformance,
      // and set their conformance warnings
      this.attributesToUpdate.forEach((attribute) => {
        let editContext = {
          action: 'boolean',
          endpointTypeIdList: this.endpointTypeIdList,
          selectedEndpoint: this.selectedEndpointTypeId,
          id: attribute.id,
          value: attribute.value,
          listType: 'selectedAttributes',
          clusterRef: attribute.clusterRef,
          attributeSide: attribute.side,
          reportMinInterval: attribute.reportMinInterval,
          reportMaxInterval: attribute.reportMaxInterval
        }
        this.setRequiredElementNotifications(
          attribute,
          attribute.value,
          'attributes'
        )
        this.$store.dispatch('zap/updateSelectedAttribute', editContext)
      })
      this.commandsToUpdate.forEach((command) => {
        let listType = command.source == 'client' ? 'selectedIn' : 'selectedOut'
        let editContext = {
          action: 'boolean',
          endpointTypeIdList: this.endpointTypeIdList,
          id: command.id,
          value: command.value,
          listType: listType,
          clusterRef: command.clusterRef,
          commandSide: command.source
        }
        this.setRequiredElementNotifications(command, command.value, 'commands')
        this.$store.dispatch('zap/updateSelectedCommands', editContext)
      })
      this.eventsToUpdate.forEach((event) => {
        let editContext = {
          action: 'boolean',
          endpointTypeId: this.selectedEndpointTypeId,
          id: event.id,
          value: event.value,
          listType: 'selectedEvents',
          clusterRef: event.clusterRef,
          eventSide: event.side
        }
        this.setRequiredElementNotifications(event, event.value, 'events')
        this.$store.dispatch('zap/updateSelectedEvents', editContext)
      })

      let updatedFeatureBits = [featureData.bit]
      this.featuresToUpdate.forEach((feature) => {
        // update enabled device type features for updated features
        this.$store.commit('zap/updateInclusionList', {
          id: featureData.featureId,
          added: feature.value,
          listType: 'enabledDeviceTypeFeatures',
          view: 'featureView'
        })
        updatedFeatureBits.push(feature.bit)
      })
      console.log('updatedFeatureBits:', updatedFeatureBits)
      console.log('featureMap:', featureMap)

      // update enabled device type features for the feature toggled by user
      let added = this.featureIsEnabled(featureData, inclusionList)
      // should also check if device type feature needs to be updated anyway?
      this.$store.commit('zap/updateInclusionList', {
        id: featureData.featureId,
        added: added,
        listType: 'enabledDeviceTypeFeatures',
        view: 'featureView'
      })

      // set notifications and pop-up warnings for the updated feature
      this.$serverPost(restApi.uri.checkConformOnFeatureUpdate, {
        featureData: featureData,
        featureMap: featureMap,
        featureConformance: this.clusterFeatureConformance,
        endpointId: this.endpointId[this.selectedEndpointId],
        endpointTypeId: this.selectedEndpointTypeId,
        changeConfirmed: true
      })
      if (this.displayWarning) {
        this.displayPopUpWarnings(this.warningMessage)
      }

      // update featureMap attribute value for the updated cluster
      this.updateFeatureMapAttribute(updatedFeatureBits)

      // close the dialog
      this.showDialog = false

      // clean the state of variables related to the dialog
      Object.assign(this, {
        displayWarning: false,
        warningMessage: '',
        disableChange: false,
        selectedFeature: {},
        updatedEnabledFeatures: [],
        featuresToUpdate: []
      })
      // })
    },
    updateFeatureMapAttribute(updatedFeatureBits) {
      // console.log('featureData:', featureData)
      let featureMapAttributeId = this.featureMapAttributeId
      let featureMapValue = parseInt(this.featureMapValue)

      // Flip all bits in the list
      updatedFeatureBits.forEach((bit) => {
        featureMapValue = featureMapValue ^ (1 << bit)
      })

      console.log('featureMapValue:', featureMapValue)

      this.$store.commit('zap/updateFeatureMapAttribute', {
        id: featureMapAttributeId,
        value: featureMapValue
      })
      let newValue = featureMapValue.toString()
      this.$serverPatch(restApi.uri.updateBitOfFeatureMapAttribute, {
        featureMapAttributeId: featureMapAttributeId,
        newValue: newValue
      })
      this.$store.commit('zap/updateFeatureMapAttributeOfDeviceTypeFeatures', {
        featureMapAttributeId: featureMapAttributeId,
        featureMapValue: newValue
      })
    },
    displayPopUpWarnings(warningMessage) {
      if (!Array.isArray(warningMessage)) {
        warningMessage = [warningMessage]
      }
      for (let warning of warningMessage) {
        Notify.create({
          message: warning,
          type: 'warning',
          classes: 'custom-notification notification-warning',
          position: 'top',
          html: true
        })
      }
    },
    buildFeatureMap(inclusionList) {
      let featureMap = {}
      this.clusterFeatures.forEach((feature) => {
        featureMap[feature.code] = this.featureIsEnabled(feature, inclusionList)
      })
      return featureMap
    },
    featureIsEnabled(featureData, inclusionList) {
      return inclusionList.includes(featureData.featureId)
    },
    /**
     * The function is called when the cluster component is initialized to
     * set required and unsupported elements based on conformance for the selected cluster.
     */
    setRequiredConformElement() {
      // let features = this.clusterFeatures
      if (Object.keys(this.clusterFeatures).length > 0) {
        let featureMap = this.buildFeatureMap(this.enabledClusterFeatures)
        // let feature = Object.values(features)[0]
        // let endpointTypeClusterId = feature.endpointTypeClusterId
        // console.log('endpointTypeClusterId:', endpointTypeClusterId)
        this.$store.dispatch('zap/setRequiredElements', {
          featureMap: featureMap,
          endpointTypeId: this.selectedEndpointTypeId,
          clusterRef: this.selectedClusterId
        })
      }
    },
    getClusterDataByRef(clusterRef) {
      return this.$store.state.zap.clusters.find(
        (cluster) => cluster.id == clusterRef
      )
    },
    processElementsForDialog(elementData) {
      return (elementData || [])
        .map((item) =>
          item.value ? 'enable ' + item.name : 'disable ' + item.name
        )
        .sort(
          // sort enabled elements before disabled ones
          (a, b) => {
            let aIsEnabled = a.includes('enabled')
            let bIsEnabled = b.includes('enabled')
            if (aIsEnabled && !bIsEnabled) return -1
            if (!aIsEnabled && bIsEnabled) return 1
            return 0
          }
        )
    },
    async loadFeatureMapAttribute(cluster) {
      console.log('loadFeatureMapAttribute')
      console.log('this.featureMapAttributeId:', this.featureMapAttributeId)
      this.$store.dispatch('zap/updateFeatureMapAttribute', {
        attributeId: this.featureMapAttribute.id,
        clusterId: cluster.id,
        endpointTypeId: this.selectedEndpointTypeId
      })
    },
    getEnabledBitsFromFeatureMapValue(featureMapValue) {
      let enabledBits = []
      for (let i = 0; i < 32; i++) {
        if ((featureMapValue & (1 << i)) != 0) {
          enabledBits.push(i)
        }
      }
      return enabledBits
    }
  },
  data() {
    return {
      showDialog: false,
      attributesToUpdate: [],
      commandsToUpdate: [],
      eventsToUpdate: [],
      featuresToUpdate: [],
      disableChange: false,
      displayWarning: false,
      warningMessage: '',
      selectedFeature: {},
      updatedEnabledFeatures: []
    }
  }
}
