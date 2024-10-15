/// <reference types="cypress" />
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test
  return false
})

describe(
  'Testing Dimmable Light workflow',
  { defaultCommandTimeout: 6000, retries: { runMode: 2, openMode: 2 } },
  () => {
    it('create a Dimmable Light endpoint', () => {
      cy.fixture('baseurl').then((data) => {
        cy.visit(data.baseurl)
      })
      cy.setZclProperties()
      cy.fixture('data').then((data) => {
        cy.addEndpoint(data.endpoint6)
      })
    })
    it('Navigate to device type feature page', () => {
      cy.get('button[data-test="device-type-feature"]').click()
      cy.url().should('include', '/feature')
      cy.get('#ZclDeviceTypeFeatureManager').should('be.visible')
      // cy.fixture('data').then((data) => {
      //   data.deviceTypeFeatures.forEach((feature) => {
      //     cy.contains(feature.deviceType).should('be.visible')
      //     cy.contains(feature.cluster).should('be.visible')
      //     cy.contains(feature.featureName).should('be.visible')
      //   })
      // })
    })
  }
)
