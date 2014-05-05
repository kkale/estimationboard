(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     * @private
     * Adds a component that allows the user to choose whether the reference wall is displayed on the  estimation board
     */
    Ext.define('Rally.ui.gridboard.plugin.ReferenceWallController', {
        alias: 'plugin.rallyestimationboardreferencewallcontroller',
        extend: 'Ext.AbstractPlugin',
        mixins: ['Rally.ui.gridboard.plugin.GridBoardControlShowable'],
        requires: [
            'Rally.data.PreferenceManager'
        ],

        /**
         * @private
         * @cfg {String} artifactTypePreferenceKey
         * Name of preference that is used to determine if the artifact types will be checked when the component loads.
         */
        artifactTypePreferenceKey: undefined,

        /**
         * @cfg {Boolean} showAgreements
         * True to show checkbox to display agreements
         */
        showAgreements: false,

        init: function(cmp) {
            this.callParent(arguments);
            this.cmp = cmp;
            this.cmp.referencewallplugin = this;

            this.showControl();

            if (this.artifactTypePreferenceKey) {
                this._getArtifactTypePreference();
            } else {
                this._addChooser();
            }
        },

        getControlCmpConfig: function() {
            return {
                itemId: 'artifactTypeChooser',
                xtype: 'container',
                cls: 'artifact-type-chooser'
            };
        },

        /**
         * Return an array of the currently chosen artifact type names.
         */
        getChosenTypeNames: function() {
            return this._getShownTypeNames();
        },

        /**
         * Return an array of configs for the chosen types
         */
        getChosenTypesConfig: function() {
            return this._getShownTypes();
        },

        _getChooserContainer: function() {
            return this.cmp.getHeader().getRight().down('#artifactTypeChooser');
        },

        _addChooser: function() {
            var itemsConfig = [];

            if (this.showAgreements) {
                itemsConfig.push({
                    xtype: 'checkboxfield',
                    cls: 'type-checkbox agreements-checkbox',
                    boxLabel: 'Agreements',
                    itemId: 'showAgreements',
                    inputValue: 'agreement',
                    handler: this._onShowAgreementsClicked,
                    scope: this
                });
            }

            this._getChooserContainer().add(itemsConfig);

            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _onCheckboxChecked: function(checkbox, checked, callback, callbackScope) {
            if (this.artifactTypePreferenceKey) {
                this._saveArtifactTypePreference(this._getShownTypeNames());
            }

            if (checkbox.inputValue !== 'agreement'){
                this._filter();
            }
            Ext.callback(callback, callbackScope || this.cmp, [checkbox, checked]);
        },

        _getArtifactTypePreference: function() {
            Rally.data.PreferenceManager.load({
                appID: this.cmp.getContext().get('appID'),
                filterByUser: true,
                filterByName: this.artifactTypePreferenceKey,
                success: this._onPreferenceQuery,
                scope: this
            });
        },

        _onPreferenceQuery: function(pref) {
            if (pref[this.artifactTypePreferenceKey]) {
                this.artifactsPref = pref[this.artifactTypePreferenceKey].split(',');
            }
            this._addChooser();
        },

        _saveArtifactTypePreference: function(value) {
            var settings = {};
            settings[this.artifactTypePreferenceKey] = value;
            Rally.data.PreferenceManager.update({
                appID: this.cmp.getContext().get('appID'),
                filterByUser: true,
                settings: settings,
                success: function(updatedRecords) {
                    this.cmp.fireEvent('preferencesaved', updatedRecords[0]);
                },
                scope: this
            });
        },

        _onShowAgreementsClicked: function (checkbox, checked) {
            console.log("Show agreements clicked");
        }
    });
})();