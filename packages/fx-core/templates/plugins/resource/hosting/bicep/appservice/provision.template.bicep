// Resources for bot
module webAppProvision '\{{PluginIdPlaceholder.Provision.webapp.path}}' = {
  name: 'webApp.Provision'
  params: {
    provisionParameters: provisionParameters
    {{#if (contains "fx-resource-identity" plugins)}}
    userAssignedIdentityId: \{{fx-resource-identity.References.identityResourceId}}
    {{/if}}
  }
}

output webAppOutput object = {
  teamsFxPluginId: 'PluginIdPlaceholder'
  skuName: webAppProvision.outputs.webAppSKU
  siteName: webAppProvision.outputs.webAppName
  validDomain: webAppProvision.outputs.webAppDomain
  appServicePlanName: webAppProvision.outputs.appServicePlanName
  webAppResourceId: webAppProvision.outputs.webAppResourceId
  siteEndpoint: webAppProvision.outputs.webAppEndpoint
}
