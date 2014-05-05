(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.kanban.EstimationApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.apps.kanban.Settings',
            'Rally.apps.kanban.Column',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardTagFilter',
            'Rally.ui.gridboard.plugin.GridBoardArtifactTypeChooser',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.cardboard.PolicyContainer',
            'Rally.ui.cardboard.CardBoard',
            'Rally.ui.cardboard.plugin.Scrollable',
            'Rally.ui.cardboard.plugin.FixedHeader'
        ],
        cls: 'kanban',
        alias: 'widget.kanbanapp',
        appName: 'Kanban',

        settingsScope: 'project',
        useTimeboxScope: true,
       

        config: {
            defaultSettings: {
                groupByField: 'ScheduleState',
                columns: Ext.JSON.encode({
                    Defined: {wip: ''},
                    'In-Progress': {wip: ''},
                    Completed: {wip: ''},
                    Accepted: {wip: ''}
                }),
                cardFields: 'FormattedID,Name,Discussion', //remove with COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS
                hideReleasedCards: false,
                showCardAge: false,
                cardAgeThreshold: 3,
                pageSize: 25
            }
        },
        
        commonCardboardConfig: {},

        launch: function() {
            this.setLoading();
            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: this._onStoryModelRetrieved,
                scope: this
            });
        },

        getOptions: function() {
            return [
                {
                    text: 'Print',
                    handler: this._print,
                    scope: this
                }
            ];
        },

        getSettingsFields: function() {
            return Rally.apps.kanban.Settings.getFields({
                shouldShowColumnLevelFieldPicker: this._shouldShowColumnLevelFieldPicker(),
                defaultCardFields: this.getSetting('cardFields'),
                isDndWorkspace: false
            });
        },

        /**
         * Called when any timebox scope change is received.
         * @protected
         * @param {Rally.app.TimeboxScope} timeboxScope The new scope
         */
        onTimeboxScopeChange: function(timeboxScope) {
            this.callParent(arguments);
            this.gridboard.destroy();
            this._addCardboardContent(this.commonCardboardConfig);
        },

        _shouldShowColumnLevelFieldPicker: function() {
            return false; 
        },
        
        _getCardboardAndColumnConfig: function() {
            var cardboardConfig = this._getCardboardConfig();
            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                cardboardConfig.columns = this._getColumnConfig(columnSetting);
            }
            return cardboardConfig;
        },

        _onStoryModelRetrieved: function(model) {
            this.groupByField = model.getField(this.getSetting('groupByField'));
            this.commonCardboardConfig = this._getCardboardAndColumnConfig();
            var useRefWall = this.getSetting("usereferencewall");
            console.log("useRefWall: ", useRefWall);
            if (useRefWall) {
                this._addReferenceStoryWall(this.commonCardboardConfig);                    	
            }
            this._addCardboardContent(this.commonCardboardConfig);
        },

        _addReferenceStoryWall:function(mycardboardconfig) {
            var cardboardConfig = Ext.clone(mycardboardconfig);
            cardboardConfig.itemId = 'cardboard';
            cardboardConfig.plugins = [];
            cardboardConfig.disabled = true;
            cardboardConfig.draggable = false;
            cardboardConfig.height = 150;
            Ext.Object.each (cardboardConfig.columns, function(index, column){
                column.columnHeaderConfig.headerTpl = "";
                column.columnHeaderConfig.value = "";           
                column.dropControllerConfig = false;
            });
            
            var query = Ext.create('Rally.data.QueryFilter', {
                property: 'Tags.Name',
                operator: 'contains',
                value: this.getSetting('referenceTag')
            });            
            cardboardConfig.storeConfig.filters.push(query);
            cardboardConfig.cardConfig = {
                editable: false,
                showIconMenus: false,
                fields: [],
                showAge: -1,
                showBlockedReason: true,
                floating: false,
                disabled: false
            };
            
            var button = {
                    xtype:"rallycheckboxfield",
                    fieldLabel: "Show Reference Wall",
                    value: true,
                    handler: function(checkbox, checked) {
                        var card = this.up('.container').down('#cardboard');
                        card.setVisible(checked);
                    }
                };

            var row = {
                    items:[button, cardboardConfig]

            };
            
            this.add(row);
            console.log("cardboard: ", this.down("[class^=column-headers]"));
        },        
        
        _addCardboardContent: function(gridcardboardConfig) {
            var cardboardConfig = Ext.clone(gridcardboardConfig);
            this.gridboard = this.add(this._getGridboardConfig(cardboardConfig));
            this.cardboard = this.gridboard.getGridOrBoard();
        },

        _getGridboardConfig: function(cardboardConfig) {
            var plugins = [
                {
                    ptype: 'rallygridboardfilterinfo',
                    isGloballyScoped: Ext.isEmpty(this.getSetting('project')) ? true : false,
                    queryString: this.getSetting('query')
                },
                {
                    ptype: 'rallygridboardartifacttypechooser',
                    artifactTypePreferenceKey: 'artifact-types',
                    showAgreements: false
                },
                'rallygridboardtagfilter'
            ];
            
            return {
                xtype: 'rallygridboard',
                stateful: false,
                toggleState: 'board',
                cardBoardConfig: cardboardConfig,
                plugins: plugins,
                context: this.getContext(),
                modelNames: this._getDefaultTypes()
            };
        },

        _getColumnConfig: function(columnSetting) {
            var columns = [];
            Ext.Object.each(columnSetting, function(column, values) {
                var columnConfig = {
                    xtype: 'kanbancolumn',
                    enableWipLimit: false,
                    wipLimit: values.sizebucket,
                    plugins: [{
                        ptype: 'rallycolumnpolicy',
                        app: this
                    }],
                    fields: this._getFieldsForColumn(values),
                    value: column,
                    columnHeaderConfig: {
                        headerTpl: column || 'No Estimate'
                    },
                    cardLimit: this.getSetting('pageSize'),
                    listeners: {
                        invalidfilter: {
                            fn: this._onInvalidFilter,
                            scope: this
                        }
                    }
                };
                columns.push(columnConfig);
            }, this);

            columns[columns.length - 1].storeConfig = {
                filters: this._getLastColumnFilter()
            };

            return columns;
        },

        _getFieldsForColumn: function(values) {
            var columnFields = [];
            if (this._shouldShowColumnLevelFieldPicker()) {
                if (values.cardFields) {
                    columnFields = values.cardFields.split(',');
                } else if (this.getSetting('cardFields')) {
                    columnFields = this.getSetting('cardFields').split(',');
                }
            }
            return columnFields;
        },

        _onInvalidFilter: function() {
            Rally.ui.notify.Notifier.showError({
                message: 'Invalid query: ' + this.getSetting('query')
            });
        },

        _getCardboardConfig: function() {
            return {
                xtype: 'rallycardboard',
                plugins: [
                    {ptype: 'rallycardboardprinting', pluginId: 'print'},
                    {ptype: 'rallyfixedheadercardboard'},
                    {
                        ptype: 'rallyscrollablecardboard',
                        containerEl: this.getEl()
                    }
                ],
                types: this._getDefaultTypes(),
                attribute: this.getSetting('groupByField'),
                margin: '10px',
                context: this.getContext(),
                listeners: {
                    beforecarddroppedsave: this._onBeforeCardSaved,
                    load: this._onBoardLoad,
                    filter: this._onBoardFilter,
                    filtercomplete: this._onBoardFilterComplete,
                    cardupdated: this._publishContentUpdatedNoDashboardLayout,
                    scope: this
                },
                columnConfig: {
                    xtype: 'rallycardboardcolumn',
                    enableWipLimit: false
                },
                cardConfig: {
                    editable: true,
                    showIconMenus: true,
                    fields: (this._shouldShowColumnLevelFieldPicker()) ? [] : this.getSetting('cardFields').split(','),
                    showAge: -1,
                    showBlockedReason: true
                },
                loadMask: false,
                storeConfig: {
                    context: this.getContext().getDataContext(),
                    pageSize: this.getSetting('pageSize'),
                    filters: this.getSetting('query') ?
                        [Rally.data.QueryFilter.fromQueryString(this.getSetting('query'))] : []
                }
            };
        },

        _getLastColumnFilter: function() {
            return  [];
        },

        _getColumnSetting: function() {
            var columnSetting = this.getSetting('columns');
            return columnSetting && Ext.JSON.decode(columnSetting);
        },

        _buildReportConfig: function(report) {
            var shownTypes = this._getShownTypes();
            var workItems = shownTypes.length === 2 ? 'N' : shownTypes[0].workItemType;

            var reportConfig = {
                report: report,
                work_items: workItems
            };
            if (this.getSetting('groupByField') !== 'ScheduleState') {
                reportConfig.filter_field = this.groupByField.displayName;
            }
            return reportConfig;
        },

        _print: function() {
            this.cardboard.openPrintPage({title: 'Estimation Board'});
        },
        _getShownTypes: function() {
            return this.gridboard.artifactTypeChooserPlugin.getChosenTypesConfig();
        },

        _getDefaultTypes: function() {
            return ['User Story', 'Defect'];
        },

        _showReportDialog: function(title, reportConfig) {
            var height = 450, width = 600;
            this.getEl().mask();
            Ext.create('Rally.ui.dialog.Dialog', {
                title: title,
                autoShow: true,
                draggable: false,
                closable: true,
                modal: false,
                height: height,
                width: width,
                listeners: {
                    close: function() {
                        this.getEl().unmask();
                    },
                    scope: this
                }
            });
        },

        _onBoardLoad: function() {
            this._publishContentUpdated();
            this.setLoading(false);
            this._initializeChosenTypes();
        },

        _onBoardFilter: function() {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function() {
            this.setLoading(false);
        },

        _initializeChosenTypes: function() {
            var artifactsPref = this.gridboard.artifactTypeChooserPlugin.artifactsPref;
            var allowedArtifacts = this.gridboard.getHeader().getRight().query('checkboxfield');
            if (!Ext.isEmpty(artifactsPref) && artifactsPref.length !== allowedArtifacts.length) {
                this.gridboard.getGridOrBoard().addLocalFilter('ByType', artifactsPref, false);
            }
        },


        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        },

        _onBeforeCardSaved: function(column, card, type) {
            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                var setting = columnSetting[column.getValue()];
                console.log("size bucket: ", setting.sizebucket);
                if (setting ) {
                    card.getRecord().set('PlanEstimate', setting.sizebucket);
                }
            }
        }
        
    });
})();
