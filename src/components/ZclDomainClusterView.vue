<!--
Copyright (c) 2008,2020 Silicon Labs.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

<template>
  <div class="row justify-center">
    <q-btn
      v-if="showEnableAllClustersButton"
      @click="showEnableAllClustersDialog = true"
      label="Enable All Clusters"
      color="primary"
      class="full-height"
      flat
      rounded
    />

    <q-table
      :rows="clusters"
      :columns="columns"
      :visible-columns="visibleColumns"
      :rows-per-page-options="[0]"
      hide-pagination
      row-key="id"
      class="col-12"
      flat
    >
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td
            key="status"
            :props="props"
            class="q-px-none"
            :class="isClusterEnabled(props.row.id) ? '' : ' disabled-cluster'"
          >
            <q-icon
              v-show="doesClusterHaveAnyWarnings(props.row)"
              name="warning"
              class="text-amber"
              style="font-size: 1.5rem"
              @click="selectCluster(props.row)"
            >
            </q-icon>
            <q-popup-edit
              :disable="!doesClusterHaveAnyWarnings(props.row)"
              :cover="false"
              :offset="[0, -54]"
              v-model="uc_label"
              class="custom-notification notification-warning q-p-lg"
              style="overflow-wrap: break-word"
            >
              <div v-show="missingRequiredUcComponents(props.row).length">
                <div class="row items-center" items-center style="padding: 0px">
                  <q-icon
                    name="warning"
                    class="text-amber q-mr-sm"
                    style="font-size: 1.5rem"
                  ></q-icon>
                  <div>
                    <strong class="vertical-middle text-subtitle2">
                      Required SLC Component not installed
                    </strong>
                    <br />
                    Install following components to continue endpoint
                    configuration.
                    <ul style="list-style-type: none; padding-left: 0px">
                      <li
                        v-for="id in missingRequiredUcComponents(props.row)"
                        :key="id"
                      >
                        {{ ucLabel(id) }}
                      </li>
                    </ul>
                  </div>
                </div>

                <div class="row no-wrap justify-end">
                  <div class="col-2">
                    <q-btn
                      unelevated
                      text-color="primary"
                      @click="
                        updateUcComponentsByClusterSelection(props.row.id, [
                          {
                            state: this.selectionClients.includes(id),
                            role: ZclClusterRole.client,
                            action: ZclClusterRoleAction.Add
                          },
                          {
                            state: this.selectionServers.includes(id),
                            role: ZclClusterRole.server,
                            action: ZclClusterRoleAction.Add
                          }
                        ])
                      "
                      >Install</q-btn
                    >
                  </div>
                </div>
              </div>

              <div class="row no-wrap" v-show="showClusterWarning(props.row)">
                <q-icon
                  name="warning"
                  class="text-amber q-mr-sm"
                  style="font-size: 1.5rem"
                ></q-icon>
                {{ getClusterWarningMessage(props.row) }}
              </div>
            </q-popup-edit>
          </q-td>
          <q-td
            key="label"
            :props="props"
            auto-width
            :class="
              isClusterEnabled(props.row.id)
                ? ' w-step-8'
                : ' disabled-cluster w-step-8'
            "
          >
            {{ props.row.label }}
          </q-td>
          <q-td
            key="requiredCluster"
            :props="props"
            :class="isClusterEnabled(props.row.id) ? '' : ' disabled-cluster'"
          >
            {{ isClusterRequired(props.row.id) }}
          </q-td>
          <q-td
            key="clusterId"
            :props="props"
            :class="isClusterEnabled(props.row.id) ? '' : ' disabled-cluster'"
          >
            {{ asHex(props.row.code, 4) }}
          </q-td>
          <q-td
            key="manufacturerId"
            :props="props"
            :class="isClusterEnabled(props.row.id) ? '' : ' disabled-cluster'"
          >
            {{
              props.row.manufacturerCode
                ? asHex(props.row.manufacturerCode, 4)
                : '---'
              /* incorporate one step here */
            }}
          </q-td>
          <q-td key="enable" :props="props">
            <q-option-group
              class="v-step-8"
              :v-model="getClusterEnabledStatusForCheckboxes(props.row.id)"
              :model-value="getClusterEnabledStatusForCheckboxes(props.row.id)"
              :options="optionsForCheckboxes"
              color="primary"
              type="checkbox"
              :disable="{
                client:
                  getClusterDisableStatus(props.row.id).client ||
                  !getClusterEnableStatus(props.row.id).client,
                server:
                  getClusterDisableStatus(props.row.id).server ||
                  !getClusterEnableStatus(props.row.id).server
              }"
              @update:model-value="handleClusterSelection(props.row.id, $event)"
              inline
            />
          </q-td>
          <q-td
            key="configure"
            :props="props"
            :class="isClusterEnabled(props.row.id) ? '' : ' disabled-cluster'"
          >
            <q-btn
              flat
              class="v-step-9"
              :color="isClusterEnabled(props.row.id) ? 'primary' : 'grey'"
              dense
              :disable="
                !isClusterEnabled(props.row.id) ||
                (this.enableServerOnly &&
                  this.getClusterEnabledStatus(props.row.id) === 'Client')
              "
              icon="o_settings"
              @click="selectCluster(props.row)"
              to="/cluster"
              :id="domainName + '-' + props.row.id"
            />
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <q-dialog
      v-model="showEnableAllClustersDialog"
      class="background-color:transparent"
    >
      <q-card>
        <q-card-section>
          <div class="text-h6">Enable All Clusters</div>
          Enabling all clusters may cause the ZCL configuration to go into an
          invalid state. Are you sure you want to enable all clusters?
        </q-card-section>
        <q-card-actions>
          <q-btn label="Cancel" v-close-popup class="col" />
          <q-btn
            :label="'Enable All Clusters'"
            color="primary"
            class="col"
            v-close-popup="showEnableAllClustersDialog"
            @click="enableAllClusters()"
            id="enable_all_clusters"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import CommonMixin from '../util/common-mixin'
import restApi from '../../src-shared/rest-api'
import uiOptions from '../util/ui-options'
import EditableAttributesMixin from '../util/editable-attributes-mixin.js'
import featureMixin from '../util/feature-mixin.js'

let ZclClusterRoleAction = {
  Add: 'add',
  Remove: 'remove',
  NoAction: 'NoAction'
}
let ZclClusterRole = { server: 'server', client: 'client' }

export default {
  name: 'ZclDomainClusterView',
  props: ['domainName', 'clusters'],
  mixins: [CommonMixin, uiOptions, EditableAttributesMixin, featureMixin],
  computed: {
    isLegalClusterFilterActive() {
      return (
        this.$store.state.zap.clusterManager.filter.label === 'Legal Clusters'
      )
    },
    isInStandalone: {
      get() {
        return this.$store.state.zap.standalone
      }
    },
    recommendedClients: {
      get() {
        return this.$store.state.zap.clustersView.recommendedClients
      }
    },
    recommendedServers: {
      get() {
        return this.$store.state.zap.clustersView.recommendedServers
      }
    },
    // Includes client clusters which are optional for a device type
    optionalClients: {
      get() {
        return this.$store.state.zap.clustersView.optionalClients
      }
    },
    // Includes server clusters which are optional for a device type
    optionalServers: {
      get() {
        return this.$store.state.zap.clustersView.optionalServers
      }
    },
    visibleColumns: function () {
      let names = this.columns.map((x) => x.name)
      let statusColumn = 'status'
      let statusShown = names.indexOf(statusColumn) > -1
      if (this.hasWarning() && !statusShown) {
        names.push(statusColumn)
      } else if (!this.hasWarning() && statusShown) {
        let i = names.indexOf(statusColumn)
        names.splice(i, 1)
      }
      return names
    },
    showEnableAllClustersButton: function () {
      let hasNotEnabled = false
      if (this.clusters && this.clusters.length > 0) {
        this.clusters.forEach((singleCluster) => {
          if (!this.isClusterEnabled(singleCluster.id)) {
            hasNotEnabled = true
            return
          }
        })
      }

      return hasNotEnabled && this.$store.state.zap.showDevTools
    }
  },
  methods: {
    getClusterEnableStatus(id) {
      // Only enforce constraints if the active filter is "Legal Clusters"
      if (!this.isLegalClusterFilterActive) {
        return { client: true, server: true } // Allow all actions
      }
      let isClientRecommended = this.recommendedClients.includes(id)
      let isServerRecommended = this.recommendedServers.includes(id)
      let isClientOptional = this.optionalClients.includes(id)
      let isServerOptional = this.optionalServers.includes(id)
      let isClientEnabled = this.selectionClients.includes(id)
      let isServerEnabled = this.selectionServers.includes(id)

      return {
        client: isClientRecommended || isClientOptional || isClientEnabled, // Allow enabling only if recommended, optional, or already enabled
        server: isServerRecommended || isServerOptional || isServerEnabled // Allow enabling only if recommended, optional, or already enabled
      }
    },
    getClusterDisableStatus(id) {
      // Only enforce constraints if the active filter is "Legal Clusters"
      if (!this.isLegalClusterFilterActive) {
        return { client: false, server: false } // No constraints
      }

      let isClientRecommended = this.recommendedClients.includes(id)
      let isServerRecommended = this.recommendedServers.includes(id)
      let isClientOptional = this.optionalClients.includes(id)
      let isServerOptional = this.optionalServers.includes(id)
      return {
        client: isClientRecommended && !isClientOptional, // Disable if recommended and not optional
        server: isServerRecommended && !isServerOptional // Disable if recommended and not optional
      }
    },
    enableAllClusters() {
      this.clusters.forEach(async (singleCluster) => {
        await this.updateZclRolesByClusterSelection(singleCluster.id, [
          {
            state: true,
            role: ZclClusterRole.client,
            action: ZclClusterRoleAction.Add
          },
          {
            state: true,
            role: ZclClusterRole.server,
            action: ZclClusterRoleAction.Add
          }
        ])
      })
    },
    hasWarning: function () {
      return !this.isInStandalone || this.isAnyClusterNotCompliant()
    },
    missingClusterMessage(clusterData) {
      let missingRequiredClusterPair = this.getMissingRequiredClusterPair(
        clusterData.id
      )
      let msg = ''
      if (
        missingRequiredClusterPair.missingClient &&
        missingRequiredClusterPair.missingServer
      ) {
        msg = 'server and client clusters, which are'
      } else {
        msg = missingRequiredClusterPair.missingClient ? 'client' : 'server'
        msg = msg + ' cluster which is'
      }
      return (
        'The configuration is missing the ' +
        msg +
        " required for this endpoint's device type."
      )
    },
    isClusterRequired(id) {
      let clientRequired = this.recommendedClients.includes(id)
      let serverRequired = this.recommendedServers.includes(id)
      if (clientRequired && serverRequired) return 'Client & Server'
      if (clientRequired) return 'Client'
      if (serverRequired) return 'Server'
      return ''
    },
    getClusterEnabledStatus(id) {
      let hasClient = this.selectionClients.includes(id)
      let hasServer = this.selectionServers.includes(id)
      if (hasClient && hasServer) return 'Client & Server'
      if (hasClient) return 'Client'
      if (hasServer) return 'Server'
      return 'Not Enabled'
    },
    /**
     *  Get cluster enabled status for checkboxes group
     *
     * @param {*} id
     * @returns Returns an array for checkboxes group
     */
    getClusterEnabledStatusForCheckboxes(id) {
      let tmp = []
      let hasClient = this.selectionClients.includes(id)
      let hasServer = this.selectionServers.includes(id)
      if (hasClient) tmp.push('client')
      if (hasServer) tmp.push('server')
      return tmp
    },
    /* A cluster is not compliant if:
       1. It is required but disabled, OR
       2. It is provisional and enabled */
    isAnyClusterNotCompliant() {
      let isNotCompliant = false
      this.recommendedClients.forEach((id) => {
        if (!this.isClientEnabled(id)) {
          isNotCompliant = true
        }
      })
      this.recommendedServers.forEach((id) => {
        if (!this.isServerEnabled(id)) {
          isNotCompliant = true
        }
      })
      this.clusters.forEach((cluster) => {
        if (this.isClusterEnabledAndProvisional(cluster)) {
          isNotCompliant = true
        }
      })
      return isNotCompliant
    },
    /**
     * Returns the warning message for a cluster, or an empty string if no warning.
     * Each cluster can have at most one warning message as
     * provisional cluster warning is only displayed for disabled clusters
     * and required cluster warning is only displayed for enabled clusters.
     *
     * @param clusterData
     */
    getClusterWarningMessage(clusterData) {
      if (this.isRequiredClusterMissingForId(clusterData.id)) {
        return this.missingClusterMessage(clusterData)
      } else if (this.isClusterEnabledAndProvisional(clusterData)) {
        return this.provisionalWarningMessage
      } else {
        return ''
      }
    },
    showClusterWarning(clusterData) {
      return this.getClusterWarningMessage(clusterData) != ''
    },
    getMissingRequiredClusterPair(id) {
      return {
        missingClient:
          this.recommendedClients.includes(id) && !this.isClientEnabled(id),
        missingServer:
          this.recommendedServers.includes(id) && !this.isServerEnabled(id)
      }
    },
    isRequiredClusterMissingForId(id) {
      let missingRequiredClusterPair = this.getMissingRequiredClusterPair(id)
      if (
        missingRequiredClusterPair.missingClient ||
        missingRequiredClusterPair.missingServer
      ) {
        return true
      } else {
        return false
      }
    },
    isClusterEnabledAndProvisional(cluster) {
      return (
        this.isClusterEnabled(cluster.id) &&
        cluster.apiMaturity == 'provisional'
      )
    },
    doesClusterHaveAnyWarnings(clusterData) {
      // disable warning if no UC components are loaded and ZAP is not in standalone mode
      if (
        this.$store.state.zap.studio.ucComponents.length == 0 &&
        !this.isInStandalone
      ) {
        return false
      }

      let id = clusterData.id
      if (this.isRequiredClusterMissingForId(id)) return true
      if (this.isClusterEnabledAndProvisional(clusterData)) return true
      if (this.missingRequiredUcComponents(clusterData).length) return true
      return false
    },
    isClusterEnabled(id) {
      return (
        this.selectionClients.includes(id) || this.selectionServers.includes(id)
      )
    },
    isClientEnabled(id) {
      return this.selectionClients.includes(id)
    },
    isServerEnabled(id) {
      return this.selectionServers.includes(id)
    },
    processZclSelectionEvent(id, event) {
      return [
        {
          role: ZclClusterRole.client,
          action: this.zclClusterRoleAction(
            this.selectionClients.includes(id),
            event.client
          ),
          state: event.client
        },
        {
          role: ZclClusterRole.server,
          action: this.zclClusterRoleAction(
            this.selectionServers.includes(id),
            event.server
          ),
          state: event.server
        }
      ]
    },
    zclClusterRoleAction(before, after) {
      if (before == true && after == false) {
        return ZclClusterRoleAction.Remove
      } else if (before == false && after == true) {
        return ZclClusterRoleAction.Add
      } else {
        return ZclClusterRoleAction.NoAction
      }
    },
    /**
     *  Modify checkbox's event to selection event
     *
     * @param {*} checkboxevent
     * @returns Returns an object value for selection event
     */
    parseCheckboxEventToSelectionEvent(event) {
      let tmpEvent = {}

      if (event.length) {
        if (event.length === 2) {
          // Client AND Server
          tmpEvent = this.clusterSelectionOptions[3]
        } else {
          // Client OR Server
          tmpEvent = this.clusterSelectionOptions.find((item) => {
            return item.label.toLowerCase() === event[0]
          })
        }
      } else {
        // Not enabled
        tmpEvent = this.clusterSelectionOptions[0]
      }

      return tmpEvent
    },
    async handleClusterSelection(id, event) {
      const activeFilter = this.$store.state.zap.clusterManager.filter.label

      // Only enforce constraints if the active filter is "Legal Clusters"
      if (activeFilter === 'Legal Clusters') {
        const disableStatus = this.getClusterDisableStatus(id)
        const enableStatus = this.getClusterEnableStatus(id)

        // Prevent disabling recommended client
        if (disableStatus.client && event.includes('client') === false) {
          this.$q.notify({
            type: 'warning',
            position: 'top',
            message:
              'You cannot disable a required client cluster for the device types on this endpoint when using a Legal Clusters Filter.'
          })
          return
        }

        // Prevent disabling recommended server
        if (disableStatus.server && event.includes('server') === false) {
          this.$q.notify({
            type: 'warning',
            position: 'top',
            message:
              'You cannot disable a required server cluster for the device types on this endpoint when using a Legal Clusters Filter.'
          })
          return
        }

        // Prevent enabling non-recommended client
        if (!enableStatus.client && event.includes('client') === true) {
          this.$q.notify({
            type: 'warning',
            position: 'top',
            message:
              'You cannot enabled a client cluster not required by the device types on this endpoint when using a Legal Clusters Filter.'
          })
          return
        }

        // Prevent enabling non-recommended server
        if (!enableStatus.server && event.includes('server') === true) {
          this.$q.notify({
            type: 'warning',
            position: 'top',
            message:
              'You cannot enabled a server cluster not required by the device types on this endpoint when using a Legal Clusters Filter.'
          })
          return
        }
      }
      let modifiedEvent = this.parseCheckboxEventToSelectionEvent(event)
      let selectionEvents = this.processZclSelectionEvent(id, modifiedEvent)

      // find out the delta
      await this.updateZclRolesByClusterSelection(id, selectionEvents)
      if (this.shareClusterStatesAcrossEndpoints()) {
        await this.$store.dispatch('zap/shareClusterStatesAcrossEndpoints', {
          endpointTypeIdList: this.endpointTypeIdList
        })
      }
      await this.updateUcComponentsByClusterSelection(id, selectionEvents)
    },
    async updateZclRolesByClusterSelection(id, event) {
      let client = event.find((x) => x.role == ZclClusterRole.client)
      let server = event.find((x) => x.role == ZclClusterRole.server)
      await this.$store
        .dispatch('zap/updateSelectedClients', {
          endpointTypeId: this.selectedEndpointTypeId,
          id: id,
          added: client.state,
          listType: 'selectedClients',
          view: 'clustersView'
        })
        .then(() =>
          this.$store.dispatch('zap/updateSelectedServers', {
            endpointTypeId: this.selectedEndpointTypeId,
            id: id,
            added: server.state,
            listType: 'selectedServers',
            view: 'clustersView'
          })
        )

      this.$store.commit('zap/updateIsClusterOptionChanged', true)
    },
    async updateUcComponentsByClusterSelection(id, selectionEvents) {
      // adding
      let addRoles = selectionEvents
        .filter((x) => x.action == ZclClusterRoleAction.Add)
        .map((x) => x.role)
      let removeRoles = selectionEvents
        .filter((x) => x.action == ZclClusterRoleAction.Remove)
        .map((x) => x.role)

      if (addRoles.length) {
        let args = {
          clusterId: id,
          side: addRoles,
          added: true
        }
        console.log(`adding uc component: ${JSON.stringify(args)}`)
        this.updateSelectedComponentRequest(args)
      }

      if (removeRoles.length && this.disableUcComponentOnZclClusterUpdate()) {
        // send Uc Comp Remove Req if no other endpoints have specific cluster/role enabled.
        let endpointsClusterInfo = await Promise.all(
          Object.keys(this.endpointId).map((id) =>
            this.$serverGet(`${restApi.uri.endpointTypeClusters}${id}`).then(
              (res) => res.data
            )
          )
        )
        endpointsClusterInfo = endpointsClusterInfo.flat()

        if (endpointsClusterInfo?.length) {
          for (const role of removeRoles) {
            let endpoints = endpointsClusterInfo.filter(
              (x) => x.clusterRef == id && x.side == role && x.enabled
            )

            if (endpoints.length == 0) {
              let args = {
                clusterId: id,
                side: [role],
                added: false
              }
              console.log(`removing uc component: ${JSON.stringify(args)}`)
              this.updateSelectedComponentRequest(args)
            }
          }
        }
      }
    },
    selectCluster(cluster) {
      this.$store.dispatch('zap/updateSelectedCluster', cluster).then(() => {
        this.$store.dispatch(
          'zap/refreshEndpointTypeCluster',
          this.selectedEndpointTypeId
        )
        this.$store.dispatch('zap/setLastSelectedDomain', this.domainName)
        this.loadFeatureMapAttribute(cluster)
      })
    },
    ucLabel(id) {
      let list = this.$store.state.zap.studio.ucComponents.filter(
        (x) => x.name === id
      )
      return list && list.length ? list[0].label : ''
    },
    missingRequiredUcComponents(cluster) {
      return this.missingUcComponentDependencies(cluster)
    }
  },

  data() {
    return {
      ZclClusterRoleAction,
      ZclClusterRole,
      showEnableAllClustersDialog: false,
      uc_label: 'uc label',
      provisionalWarningMessage: 'Support for the cluster is provisional',
      clusterSelectionOptions: [
        { label: 'Not Enabled', client: false, server: false },
        { label: 'Client', client: true, server: false },
        { label: 'Server', client: false, server: true },
        { label: 'Client & Server', client: true, server: true }
      ],
      optionsForCheckboxes: [
        {
          label: 'Client',
          value: 'client'
        },
        {
          label: 'Server',
          value: 'server'
        }
      ],
      columns: [
        {
          name: 'status',
          required: false,
          label: '',
          align: 'left',
          field: (row) => row.code,
          style: 'width: 100px;padding-left: 10px;padding-right: 0px;'
        },
        {
          name: 'label',
          required: true,
          label: 'Cluster',
          align: 'left',
          field: (row) => row.label,
          style: 'width:28%'
        },
        {
          name: 'requiredCluster',
          required: true,
          label: 'Required Cluster',
          align: 'center',
          field: (row) => this.isClusterRequired(row.id),
          style: 'width:20%'
        },
        {
          name: 'clusterId',
          required: false,
          label: 'Cluster ID',
          align: 'left',
          field: (row) => row.code,
          style: 'width:10%'
        },
        {
          name: 'manufacturerId',
          required: false,
          label: 'Manufacturer Code',
          align: 'left',
          field: (row) => (row.manufacturerCode ? row.manufacturerCode : '---'),
          style: 'width:10%'
        },
        {
          name: 'enable',
          required: false,
          label: 'Enable',
          align: 'left',
          field: (row) => 'test',
          style: 'width:20%'
        },
        {
          name: 'configure',
          required: true,
          label: 'Configure',
          align: 'center',
          style: 'width: 10%'
        }
      ]
    }
  },
  created() {
    // This function check you created endpoint before and right now you are in the tutorial steps, then sets cluster data
    if (this.clusters !== undefined) {
      if (this.clusters[0].domainName == this.$store.state.zap.domains[0]) {
        this.$store.commit('zap/setClusterDataForTutorial', this.clusters[0])
      }
    }
  }
}
</script>

<!-- Notice lang="scss" -->
<style lang="scss">
.bar {
  background-color: $grey-4;
  padding: 15px 15px 15px 15px;
}

.q-table th,
.q-table td {
  padding: 5px;
  background-color: inherit;
  text-align: center;
}

.q-table thead th {
  border-color: rgba(173, 173, 173, 1);
}

.q-table tbody td {
  border-style: dashed !important;
}

.disabled-cluster {
  opacity: 0.3 !important;
}
</style>
