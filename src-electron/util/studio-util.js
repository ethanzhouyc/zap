/**
 *
 *    Copyright (c) 2023 Silicon Labs
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
 * @module JS API: Studio utilities
 */

const path = require('path')

/**
 *  Extract project name from the Studio project path
 * @param {} db
 * @param {*} sessionId
 * @returns '' if parsing fails
 */
function projectName(studioProjectPath) {
  // undo the manual trickery from the Studio side.
  try {
    let p = path.parse(decodeURIComponent(studioProjectPath.replace(/_/g, '%')))
    return p.name
  } catch (error) {
    return ''
  }
}

exports.projectName = projectName
