/*
 * Copyright (c) Microsoft
 * All rights reserved.
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* tslint:disable */
import { logger } from "essex.powerbi.base/dist/lib/utils/logger";
import { capabilities } from "essex.powerbi.base/dist/lib/utils/capabilities";
import PropertyPersister from "essex.powerbi.base/dist/lib/utils/PropertyPersister";
import createPropertyPersister from "essex.powerbi.base/dist/lib/utils/createPropertyPersister";
import Visual from "essex.powerbi.base/dist/lib/utils/Visual";
import UpdateType from "essex.powerbi.base/dist/lib/utils/UpdateType";
import { receiveUpdateType } from "essex.powerbi.base/dist/lib/Utils/receiveUpdateType";
import { IDimensions, receiveDimensions, IReceiveDimensions } from "essex.powerbi.base/dist/lib/Utils/receiveDimensions";
import {
    publishReplace,
    publishChange,
} from "pbi-stateful/src/stateful";
import { StatefulVisual } from "pbi-stateful/src/StatefulVisual";

import * as _ from "lodash";
import * as $ from "jquery";
const ldget = require("lodash.get");
import IVisualHostServices = powerbi.IVisualHostServices;
import DataView = powerbi.DataView;
import data = powerbi.data;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import PixelConverter = jsCommon.PixelConverter;

import { isStateEqual } from "../Utils";
import { buildPersistObjectsFromState, buildStateFromPowerBI } from "./stateConversion";
import { buildSelfFilter } from "./expressions";
import converter from "./dataConversion";
import capabilitiesData from "./AttributeSlicerVisual.capabilities";
import { createValueFormatter } from "./formatting";
import { default as createPersistObjectBuilder } from "./persistence";
import { ListItem, SlicerItem, SETTING_DESCRIPTORS } from "./interfaces";
import { IAttributeSlicerState } from "../interfaces";
import { AttributeSlicer as AttributeSlicerImpl } from "../AttributeSlicer";
const log = logger("essex.widget.AttributeSlicerVisual");
const CUSTOM_CSS_MODULE = require("!css!sass!./css/AttributeSlicerVisual.scss");
const stringify = require("json-stringify-safe");

/* tslint:enable */

// PBI Swallows these
const EVENTS_TO_IGNORE = "mousedown mouseup click focus blur input pointerdown pointerup touchstart touchmove touchdown";

function hashString(input: string): number {
  "use strict";
  let hash = 0;
  if (input.length === 0) {
    return hash;
  }
  for (let i = 0, len = input.length; i < len; i++) {
    const chr   = input.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

@Visual(require("../build").output.PowerBI)
@receiveDimensions
@capabilities(capabilitiesData)
export default class AttributeSlicer extends StatefulVisual<IAttributeSlicerState> {
    /**
     * My AttributeSlicer
     */
    protected mySlicer: AttributeSlicerImpl;

    /**
     * The display units for the values
     */
    protected labelDisplayUnits = 0;

    /**
     * The precision to use with the values
     */
    protected labelPrecision: number = 0;

    /**
     * The current dataView
     */
    private dataView: DataView;

    /**
     * The host of the visual
     */
    private host: IVisualHostServices;

    /**
     * The deferred used for loading additional data into attribute slicer
     */
    private loadDeferred: JQueryDeferred<SlicerItem[]>;

    /**
     * The current category that the user added
     */
    private currentCategory: any;

    /*
     * The current set of cacheddata
     */
    private data: SlicerItem[];

    /**
     * A property persister
     */
    private propertyPersister: PropertyPersister;

    /**
     * Constructor
     */
    constructor(noCss = false) {
        super("Attribute Slicer", noCss);

        const className = CUSTOM_CSS_MODULE && CUSTOM_CSS_MODULE.locals && CUSTOM_CSS_MODULE.locals.className;
        if (className) {
            this.element.addClass(className);
        }

        // HACK: PowerBI Swallows these events unless we prevent propagation upwards
        this.element.on(EVENTS_TO_IGNORE, (e: any) => e.stopPropagation());
    }

    /**
     * Gets the template associated with the visual
     */
    public get template() {
        return "<div></div>";
    }

    /**
     * Called when the visual is being initialized
     */
    public onInit(options: powerbi.VisualInitOptions): void {
        this.host = options.host;
        this.propertyPersister = createPropertyPersister(this.host, 100);

        const slicerEle = $("<div>");
        this.element.append(slicerEle);
        const mySlicer = new AttributeSlicerImpl(slicerEle);
        mySlicer.serverSideSearch = true;
        mySlicer.events.on("loadMoreData", this.onLoadMoreData.bind(this));
        mySlicer.events.on("canLoadMoreData", this.onCanLoadMoreData.bind(this));
        mySlicer.events.on("selectionChanged", this.onSelectionChanged.bind(this));
        mySlicer.events.on("searchPerformed", this.onSearchPerformed.bind(this));

        // Hide the searchbox by default
        mySlicer.showSearchBox = false;
        this.mySlicer = mySlicer;
    }

    /**
     * Called when the dimensions of the visual have changed
     */
    public setDimensions(value: {width: number, height: number}) {
        if (this.mySlicer) {
            this.mySlicer.dimensions = value;
        }
    }

    /**
     * Called when the visual is being updated
     */
    public onUpdate(options: powerbi.VisualUpdateOptions, updateType: UpdateType) {
        log("Update", options);
        const dv = this.dataView = options.dataViews && options.dataViews[0];
        const newState = buildStateFromPowerBI(dv);
        this.onUpdateLoadData(updateType, dv, newState);
        this.onUpdateLoadState(dv, newState);
    }

    /**
     * Sets the given state into the attribute slicer
     */
    public onSetState(state: IAttributeSlicerState) {
        log("setstate ", state);

        // The old state passed in the params, is the old *cached* version, so if we change the state ourselves
        // Then oldState will not actually reflect the correct old state.
        const currentState = this.generateState();
        // Since the other one is cached.
        if (!isStateEqual(state, currentState)) {
            state = _.cloneDeep(state);

            // Set the state on the slicer
            this.mySlicer.state = state;

            // Slicer is loaded, now sync with PBI
            const labelPrecision =
                this.labelPrecision !== (this.labelPrecision = ldget(state, "settings.display.labelPrecision", 0));
            const labelDisplayUnits =
                this.labelDisplayUnits !== (this.labelDisplayUnits = ldget(state, "settings.display.labelDisplayUnits", 0));

            if ((labelPrecision || labelDisplayUnits) && this.mySlicer.data) {
                const formatter = createValueFormatter(this.labelDisplayUnits, this.labelPrecision);

                // Update the display values in the datas
                this.mySlicer.data.forEach(n => {
                    (n.sections || []).forEach(section => {
                        section.displayValue = formatter.format(section.value);
                    });
                });

                // Tell the slicer to repaint
                this.mySlicer.refresh();
            }
            this.writeStateToPBI(state);
        }
    }

    /**
     * Enumerates the instances for the objects that appear in the power bi panel
     */
    protected handleEnumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        super.handleEnumerateObjectInstances(options);
        let instances = super.enumerateObjectInstances(options) || [{
            /*tslint:disable */selector: null/* tslint:enable */,
            objectName: options.objectName,
            properties: {},
        }] as VisualObjectInstance[];
        const instance = instances[0];
        const props = instance.properties;
        const state = this.state;
        if (state.settings[options.objectName]) {
            _.merge(props, state.settings[options.objectName]);
        }
        if (options.objectName === "general") {
            props["textSize"] = PixelConverter.toPoint(parseFloat(props["textSize"] + ""));
        }
        return instances;
    }

    /**
     * Gets called when PBI destroys this visual
     */
    public destroy() {
        super.destroy();
        if (this.mySlicer) {
            this.mySlicer.destroy();
        }
    }

    public areEqual(state1: IAttributeSlicerState, state2: IAttributeSlicerState): boolean {
        const result = _.isEqual(state1, state2);
        log("areEqual?::%s", result, state1, state2);
        return result;
    }

    public getHashCode(state: IAttributeSlicerState): number {
        return hashString(stringify(state));
    }

    /**
     * Gets the inline css used for this element
     */
    protected getCustomCssModules(): any[] {
        return [CUSTOM_CSS_MODULE];
    }

    /**
     * Generates a new state
     */
    protected generateState() {
        const baseState = this.mySlicer.state;
        return _.merge({}, baseState, {
            settings: {
                display: {
                    labelDisplayUnits: this.labelDisplayUnits || 0,
                    labelPrecision: this.labelPrecision || 0,
                },
            },
        });
    }

    /**
     * Checks whether or not to load data from the dataView
     */
    private onUpdateLoadData(updateType: UpdateType, dv: DataView, pbiState: IAttributeSlicerState) {
        // Load data if the data has definitely changed, sometimes however it hasn't actually changed
        // ie search for Microsof then Microsoft
        if (dv) {
            if ((updateType & UpdateType.Data) === UpdateType.Data || this.loadDeferred) {
                const data = converter(dv);

                log("Loading data from PBI");

                this.data = data || [];
                let filteredData = this.data.slice(0);

                // If we are appending data for the attribute slicer
                if (this.loadDeferred && this.mySlicer.data && !this.loadDeferred["search"]) {
                    // we only need to give it the new items
                    this.loadDeferred.resolve(filteredData.slice(this.mySlicer.data.length));
                    delete this.loadDeferred;
                } else {
                    this.mySlicer.data = filteredData;

                    // Restore selection
                    this.mySlicer.selectedItems = <any>(pbiState.selectedItems || []);

                    delete this.loadDeferred;
                }

                const columnName = ldget(dv, "categorical.categories[0].source.queryName");

                // if the user has changed the categories, then selection is done for
                if (!columnName ||
                    (this.currentCategory && this.currentCategory !== columnName)) {
                    // This will really be undefined behaviour for pbi-stateful because this indicates the user changed datasets
                    log("Clearing Selection, Categories Changed");
                    pbiState.selectedItems = [];
                    pbiState.searchText = "";
                }

                this.currentCategory = columnName;
            }
        } else {
            this.mySlicer.data = [];
            pbiState.selectedItems = [];
        }
    }

    /**
     * Checks if the settings have changed from PBI
     */
    private onUpdateLoadState(dv: DataView, pbiState: IAttributeSlicerState) {
        // Important that this is done down here for selection to be retained
        const oldState = this.generateState();
        if (!isStateEqual(oldState, pbiState)) {

            const oldSettings = oldState.settings;
            const newSettings = pbiState.settings;
            const differences: string[] = [];
            Object.keys(newSettings).forEach(secN => {
                const section = newSettings[secN];
                Object.keys(section).forEach(setN => {
                    const oldSetting = ldget(oldSettings, `${secN}.{setN}`);
                    const newSetting = ldget(newSettings, `${secN}.{setN}`);
                    if (!_.isEqual(oldSetting, newSetting)) {
                        const descriptor = SETTING_DESCRIPTORS[secN][setN];
                        differences.push(descriptor ? descriptor.displayName : setN);
                    }
                });
            });

            // New state has changed, so update the slicer
            log("PBI has changed, updating state");
            this.state = pbiState;

            // If there are any settings updates
            if (differences.length || !_.isEqual(oldSettings, newSettings)) {
                const name = `Updated Settings${ differences.length ? ": " + differences.join(", ") : "" }`;
                // ctrevino - Publishing a state change here causes invisible states to pop in with multiple visuals.
                publishReplace(this, name, pbiState);
            }
        }
    }

    /* tslint:disable */
    /**
     * The debounced version of the selection changed
     */
    private _onSelectionChangedDebounced = _.debounce( /* tslint:enable */
        (selectedItems: ListItem[]) => {
            log("onSelectionChanged");
            const selection = selectedItems.map(n => n.match).join(", ");
            const text = selection && selection.length ? `Select ${selection}` : "Clear Selection";
            const newState = this.generateState();
            this.setStateAndPublishChange(newState, text);
            this.writeStateToPBI(newState);
        },
    100);

    /**
     * Listener for when the selection changes
     */
    private onSelectionChanged(newItems: ListItem[]) {
        if (!this.isHandlingSetState && !this.isHandlingUpdate) {
            this._onSelectionChangedDebounced(newItems);
        }
    }

    /**
     * Listener for searches being performed
     */
    private onSearchPerformed(searchText: string) {
        if (!this.isHandlingSetState) {
            const text = searchText && searchText.length ? `Search for "${searchText}"` : "Clear Search";
            this.setStateAndPublishChange(this.generateState(), text);
        }
    }

    /**
     * Listener for can load more data
     */
    private onCanLoadMoreData(item: any, isSearch: boolean) {
        return item.result = !!this.dataView && (isSearch || !!this.dataView.metadata.segment);
    }

    /**
     * Listener for when loading more data
     */
    private onLoadMoreData(item: any, isSearch: boolean) {
        if (isSearch) {
            // Set the search filter on PBI
            const builder = createPersistObjectBuilder();
            builder.persist("general", "selfFilter", buildSelfFilter(this.dataView, this.mySlicer.searchString));
            this.propertyPersister.persist(false, builder.build());

            // Set up the load deferred, and load more data
            this.loadDeferred = $.Deferred();

            // Let the loader know that it is a search
            this.loadDeferred["search"] = true;
            item.result = this.loadDeferred.promise();
        } else if (this.dataView.metadata.segment) {
            let alreadyLoading = !!this.loadDeferred;
            if (this.loadDeferred) {
                this.loadDeferred.reject();
            }

            this.loadDeferred = $.Deferred();
            item.result = this.loadDeferred.promise();
            if (!alreadyLoading) {
                this.host.loadMoreData();
                log("Loading more data");
            }
        }
    }

    /**
     * Sets the given state and calls publishChange to announce the change that caused this state
     */
    private setStateAndPublishChange(newState: IAttributeSlicerState, text: string) {
        this.state = newState;
        publishChange(this, text, newState);
    }

    /**
     * Syncs the given state back to PBI
     */
    private writeStateToPBI(state: IAttributeSlicerState) {
        log("AttributeSlicer loading state into PBI", state);
        if (state && this.host) {
            // Stolen from PBI's timeline
            this.propertyPersister.persist(true, buildPersistObjectsFromState(this.dataView, state));
        }
    }
}