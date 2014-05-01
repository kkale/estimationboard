(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     *
     */
    Ext.define('Rally.apps.kanban.Settings', {
        singleton: true,
        requires: [
            'Rally.apps.kanban.ColumnSettingsField',
            'Rally.ui.combobox.FieldComboBox',
            'Rally.ui.picker.FieldPicker',
            'Rally.ui.CheckboxField',
            'Rally.ui.plugin.FieldValidationUi'
        ],

        getFields: function(config) {
            var alwaysSelectedValues = ['FormattedID', 'Name'];
            var items = [
                {
                    name: 'groupByField',
                    xtype: 'rallyfieldcombobox',
                    model: Ext.identityFn('UserStory'),
                    margin: '10px 0 0 0',
                    fieldLabel: 'Size By',
                    listeners: {
                        select: function(combo) {
                            this.fireEvent('fieldselected', combo.getRecord().get('fieldDefinition'));
                        },
                        ready: function(combo) {
                            combo.store.filterBy(function(record) {
                                var attr = record.get('fieldDefinition').attributeDefinition;
                                return attr && !attr.ReadOnly && attr.Constrained && attr.AttributeType !== 'OBJECT' && attr.AttributeType !== 'COLLECTION';
                            });
                            if (combo.getRecord()) {
                                this.fireEvent('fieldselected', combo.getRecord().get('fieldDefinition'));
                            }
                        }
                    },
                    bubbleEvents: ['fieldselected', 'fieldready']
                },
                {
                    name: 'columns',
                    readyEvent: 'ready',
                    fieldLabel: '',
                    margin: '5px 0 0 80px',
                    xtype: 'kanbancolumnsettingsfield',
                    shouldShowColumnLevelFieldPicker: false,
                    defaultCardFields: config.defaultCardFields,
                    handlesEvents: {
                        fieldselected: function(field) {
                            this.refreshWithNewField(field);
                        }
                    },
                    listeners: {
                        ready: function() {
                            this.fireEvent('columnsettingsready');
                        }
                    },
                    bubbleEvents: 'columnsettingsready'
                }
            ];

            if (!config.shouldShowColumnLevelFieldPicker) {
                var fieldBlackList = ['DisplayColor'];
                items.push({
                    name: 'cardFields',
                    fieldLabel: 'Card Fields',
                    xtype: 'rallyfieldpicker',
                    modelTypes: ['userstory', 'defect'],
                    fieldBlackList: fieldBlackList,
                    alwaysSelectedValues: alwaysSelectedValues,
                    listeners: {
                        selectionchange: function(picker) {
                            picker.validate();
                        }
                    },
                    handlesEvents: {
                        columnsettingsready: function() {
                            if (this.picker) {
                                this.alignPicker();
                            }
                        }
                    }
                });
            }
            
            items.push(
                {
                    name: 'pageSize',
                    xtype: 'rallynumberfield',
                    plugins: ['rallyfieldvalidationui'],
                    fieldLabel: 'Page Size',
                    allowDecimals: false,
                    minValue: 1,
                    maxValue: 100,
                    allowBlank: false,
                    validateOnChange: false,
                    validateOnBlur: false
                },
                {
                    name: 'referenceTag',
                    xtype: 'rallytextfield',
                    fieldLabel: 'Reference Story Tag'
                },
                {
                    type: 'query'
                }
            );

            return items;
        }
    });
})();