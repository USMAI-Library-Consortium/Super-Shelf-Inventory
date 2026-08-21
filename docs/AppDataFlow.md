# App Data Flow

This document will describe how each screen in this application works under
the hood. The services used by each screen (component) will not be described
in detail, but they use more traditional programming style (api calls, if/else)
than Angular Components so it's not as critical.

Throughout this guide, I will show how each page initializes or reacts to
certain events. This is because web programming is event-driven. There are other
things pages might do, but I believe these to be the most necessary to
describe.

## First Application Screen (barcode-input component)

The app begins with a screen prompting the user to input an excel file with a
list of barcodes. This page responds mainly to two events.

### User File Input

1. A user uploading a file will trigger the `onFileSelect` method.
2. If a file is present, the app will use the `BarcodeParserService` to parse
   its contents.
3. If barcodes are present in this file, the method will set the Scan Date
   to the file's last modified date. This can still be modified by a user.
4. If barcodes are present, the method will call the StateService's
   `findSimilarRuns` method. This method is one part of the app's caching
   feature - it checks whether this file has already been processed and allows
   the user to re-upload its data to avoid processing delay. If there is a similar
   run, it enables the switch that allows the user to use cached results.
5. File Information is saved to the `BarcodeParserService`.

### User Clicks Next

The submit button is enabled only if (a) a valid barcode file has been uploaded
and (b) the app is not currently processing another barcode file.

This Submit function is in charge of beginning the data load process. The app
must get Alma data for all barcodes (if present) to work correctly.

The app has 2 different data load modes - API ('Simplicity' in the UI) and Job
('Large Dataset' in the UI). Each one loads data in a different way.

#### API Mode

1. Use the `pullItemData` function of the `BackupItemExportService` to pull items
   via the API one-by-one. (it's called 'backup' because it was originally only
   a backup for users that didn't have job permissions. But I found it to be quick
   enough to have it be a mainstream option, now the default!)
2. This creates a PhysicalItems array, which is then saved in the
   `PhysicalItemInfoService`.
3. Navigate the user to the `report-form` component (where users select their
   report settings).

#### Job Mode

1. Check if the setting to use cached results is active. If so, pass the run
   information to the `ExportJobService`, which allows it to prompt the user
   to look for a job they ran some time ago.
2. If inactive, create a set of the file barcodes using the `SetService`
3. Attempt to run an 'Export Physical Items Information' job on this set:
4. If not successful, this is likely due to a permissions error. Fall back to
   API mode, which has lesser permissions requirements.
5. COMBINE the results of the two - meaning the result could be the result of
   the `ExportJobService` run OR the `BackupItemInformationService` run.
6. If it's an `ExportJobService` run, navigate the user to the `job-result-input`
   component so that they can manually input the results of the 'Export Physical
   Items Information' job.
7. If it's a `BackupItemInformationService` run, navigate the user to the
   `report-form` component (where users select their report settings) just as in
   the [API Mode](#api-mode) section.

## Second Application Screen (used for Job mode only)

This screen is intended to prompt the user to look for the results of the 'Export
Physical Items Information' job, and then upload it into the app. In the 'Job' mode,
this is how the app gets its information.

### User Uploads File

1. The `onFileSelect` method is triggered.
2. The method uses the `ExportJobService.parseReport` method to parse the excel
   file produced by the job, producing a PhysicalItems array.
3. Physical Items array is 'saved' in the `PhysicalItemInfoService` for use by
   future components.
4. The option to move to the next step is made clickable.

### User clicks Next

The user is navigated to the `report-form` component.

## Third Application Screen - Report Form Component

This component is where the user puts in their desired report settings. This may
include the desire call number type, correct locations, sort order, etc.

### Component Initialization

The component does a few important things before the UI is displayed to the user.

#### Parsing Physical Item Information

When this component initializes, it goes through the physical item information (from
the `PhysicalItemInfoService`) and parses a lot of info. The info that it
parses allows the UI to populate dropdowns of libraries, locations, etc that
are present in the dataset, as well as selecting reasonable defaults (what
locations are valid? What item types? etc).

#### Configuring Postprocess Options

Postprocess use is dependent on ExLibris's ConfigurationService. Their service stores
whether a General System Administrator has (a) enabled 'marking items as inventoried',
and if so, which field this information should be stored in, and (b) whether
the GSA has enabled Scanning In items. This is the ONLY non-api cloud app service
that saves data outside of the user's browser. This data applies to all users of
a cloud app in a particular institution.

Postprocess options are set by a General System Administrator using the
app's `administration` component

If either postprocess option is enabled, the `enableOrDisablePostprocess` method
will enable or disable that option on the report form.

The circ desk input field will be enabled if the 'scan in items' feature is enabled.

### Changing Problems to Report On

If the user changes which problems to report on, the app may enable/disable the
'Report Only Problems' feature. The 'Report Only Problems' feature sets the
report to only include records with problems in the output. This is useful for
when we're looking for Alma misconfigurations, such as wrong item type, but in
my opinion didn't make sense for any report with item order information.

This may not be needed any longer. I created it when the application wasn't so
accurate in creating a notification for when an item was out of order. But hopefully
you can see my logic - if we're focusing on ordering, it's nice to see everything.

This enabling/disabling happens in the `enableOrDisableReportOnlyProblems` method.

### Submit/Next

1. The method will read the form and create a report using the `ReportService`.
   This report service is complex, but its usage in this component is quite
   simple. This is a synchronous operation.
2. If the user has opted to mark items as inventoried, the app will create an
   observable which (a) uses the existing Alma set from the first application
   screen if present OR create a new one if not (which is a method provided by
   the `SetService`); (b) run a job on that set to add the information that
   each item has been inventoried to Alma (using a method provided by the
   `PostProcessService`). This observable is not run yet.
3. If the user has opted to scan in items, the app will create an observable which
   uses the `PostProcessService.scanInItems` method to scan in each item that's
   not in place using the API. It is not yet run.
4. If _either_ job is selected, the component will combine the jobs so that they
   are both run at once, navigating the user to the results component once complete.
5. If _neither_ job is selected, the component will immediately redirect the user
   to the results component.

## Fourth Application Screen - Results Component

The results component is where the user can view a simple overview of the results
and download the detailed results file.

The component gets the report data from the `ReportService`; this is done directly
in the Angular template and is not visible in the typescript file. The same is
true for the results of the postprocessing - they are pulled directly from the
`PostProcessService` in the Angular template.

### Report Download

The report download feature uses the `generateAndDownloadExcel` method on the
`ReportService`.

### Submit/Next

If the user clicks 'next', the application will return to the first screen (barcode
input component). The barcode input component will reset all of the services so
that the user can start fresh.

### Back

While the other components have 'back' buttons, this is probably the most likely
to be used because the user may want to run multiple report types or may realize
they misconfigured something.

The _ReportForm_ component (where the `ResultsComponent` links back to) has a
`resetServices` method that clears all the data from the report & the
postprocess service whenever the it is initialized. This means, when a user
clicks 'back' from the `ResultsComponent`, all the report data from the last
time they ran it will be cleared.

This is important in case, say, there's an old markAsInventoried job that didn't
finish running. If we didn't reset the services, the results component could
then display the results for the previous run (this may not be possible, but
there are things like this that can) happen.

Of course, we don't want to reset the data that this component relies on,
otherwise the app will break! This is why each component has a carefully thought
out `resetServices` function, called whenever it is initialized, that wipes
any data that it might have created in the past. Having it in the init function
saves us from having to wipe one component's data in another component.
