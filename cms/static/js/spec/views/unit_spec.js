define(["jquery", "underscore", "jasmine", "coffee/src/views/unit", "js/models/module_info",
    "js/views/feedback_notification", "js/spec_helpers/create_sinon", "js/spec_helpers/edit_helpers",
    "jasmine-stealth"],
    function ($, _, jasmine, UnitEditView, ModuleModel, NotificationView, create_sinon, edit_helpers) {
        var requests, unitView, initialize, respondWithHtml, verifyJSON, verifyComponents, verifyNotification, i;

        respondWithHtml = function(html, requestIndex) {
            if (_.isUndefined(requestIndex)) {
                requestIndex = requests.length - 1;
            }
            create_sinon.respondWithJson(
                requests,
                { html: html, "resources": [] },
                requestIndex
            );
        };

        initialize = function(test) {
            var mockXBlockHtml = readFixtures('mock/mock-unit-page-xblock.underscore'),
                templates,
                model;
            requests = create_sinon.requests(test);
            templates = edit_helpers.mockComponentTemplates;
            model = new ModuleModel({
                id: 'unit_locator',
                state: 'draft'
            });
            unitView = new UnitEditView({
                el: $('.main-wrapper'),
                templates: templates,
                model: model
            });
            // Respond with renderings for the two xblocks in the unit
            respondWithHtml(mockXBlockHtml, 0);
            respondWithHtml(mockXBlockHtml, 1);
        };

        verifyJSON = function (requests, json) {
            var request = requests[requests.length - 1];
            expect(request.url).toEqual("/xblock");
            expect(request.method).toEqual("POST");
            // There was a problem with order of returned parameters in strings.
            // Changed to compare objects instead strings.
            expect(JSON.parse(request.requestBody)).toEqual(JSON.parse(json));
        };

        verifyComponents = function (unit, locators) {
            var components = unit.$(".component");
            expect(components.length).toBe(locators.length);
            for (i = 0; i < locators.length; i++) {
                expect($(components[i]).data('locator')).toBe(locators[i]);
            }
        };

        verifyNotification = function (notificationSpy, text, requests) {
            expect(notificationSpy.constructor).toHaveBeenCalled();
            expect(notificationSpy.show).toHaveBeenCalled();
            expect(notificationSpy.hide).not.toHaveBeenCalled();
            var options = notificationSpy.constructor.mostRecentCall.args[0];
            expect(options.title).toMatch(text);
            create_sinon.respondWithJson(requests, {"locator": "new_item"});
            expect(notificationSpy.hide).toHaveBeenCalled();
        };

        beforeEach(function() {
            edit_helpers.installMockXBlock();

            // needed to stub out the ajax
            window.analytics = jasmine.createSpyObj('analytics', ['track']);
            window.course_location_analytics = jasmine.createSpy('course_location_analytics');
            window.unit_location_analytics = jasmine.createSpy('unit_location_analytics');
        });

        afterEach(function () {
            edit_helpers.uninstallMockXBlock();
        });

        describe("UnitEditView", function() {
            beforeEach(function() {
                edit_helpers.installViewTemplates();
                edit_helpers.installTemplate('add-xblock-component');
                edit_helpers.installTemplate('add-xblock-component-button');
                edit_helpers.installTemplate('add-xblock-component-menu');
                edit_helpers.installTemplate('add-xblock-component-menu-problem');
                appendSetFixtures(readFixtures('mock/mock-unit-page.underscore'));
            });

            describe('duplicateComponent', function() {
                var clickDuplicate;

                clickDuplicate = function (index) {
                    unitView.$(".duplicate-button")[index].click();
                };

                it('sends the correct JSON to the server', function () {
                    initialize(this);
                    clickDuplicate(0);
                    verifyJSON(requests, '{"duplicate_source_locator":"loc_1","parent_locator":"unit_locator"}');
                });

                it('inserts duplicated component immediately after source upon success', function () {
                    initialize(this);
                    clickDuplicate(0);
                    create_sinon.respondWithJson(requests, {"locator": "duplicated_item"});
                    verifyComponents(unitView, ['loc_1', 'duplicated_item', 'loc_2']);
                });

                it('inserts duplicated component at end if source at end', function () {
                    initialize(this);
                    clickDuplicate(1);
                    create_sinon.respondWithJson(requests, {"locator": "duplicated_item"});
                    verifyComponents(unitView, ['loc_1', 'loc_2', 'duplicated_item']);
                });

                it('shows a notification while duplicating', function () {
                    var notificationSpy = spyOnConstructor(NotificationView, "Mini", ["show", "hide"]);
                    notificationSpy.show.andReturn(notificationSpy);
                    initialize(this);
                    clickDuplicate(0);
                    verifyNotification(notificationSpy, /Duplicating/, requests);
                });

                it('does not insert duplicated component upon failure', function () {
                    initialize(this);
                    clickDuplicate(0);
                    create_sinon.respondWithError(requests);
                    verifyComponents(unitView, ['loc_1', 'loc_2']);
                });
            });

            describe('createNewComponent ', function () {
                var clickNewComponent;

                clickNewComponent = function () {
                    unitView.$(".new-component .new-component-type a.single-template").click();
                };

                it('sends the correct JSON to the server', function () {
                    initialize(this);
                    clickNewComponent();
                    verifyJSON(requests, '{"category":"discussion","type":"discussion","parent_locator":"unit_locator"}');
                });

                it('inserts new component at end', function () {
                    initialize(this);
                    clickNewComponent();
                    create_sinon.respondWithJson(requests, {"locator": "new_item"});
                    verifyComponents(unitView, ['loc_1', 'loc_2', 'new_item']);
                });

                it('shows a notification while creating', function () {
                    var notificationSpy = spyOnConstructor(NotificationView, "Mini", ["show", "hide"]);
                    notificationSpy.show.andReturn(notificationSpy);
                    initialize(this);
                    clickNewComponent();
                    verifyNotification(notificationSpy, /Adding/, requests);
                });

                it('does not insert duplicated component upon failure', function () {
                    initialize(this);
                    clickNewComponent();
                    create_sinon.respondWithError(requests);
                    verifyComponents(unitView, ['loc_1', 'loc_2']);
                });
            });

            describe("Disabled edit/publish links during ajax call", function() {
                var link, i,
                    draft_states = [
                        {
                            state: "draft",
                            selector: ".publish-draft"
                        },
                        {
                            state: "public",
                            selector: ".create-draft"
                        }
                    ];

                function test_link_disabled_during_ajax_call(draft_state) {
                    it("re-enables the " + draft_state.selector + " link once the ajax call returns", function() {
                        initialize(this);
                        link = $(draft_state.selector);
                        expect(link).not.toHaveClass('is-disabled');
                        link.click();
                        expect(link).toHaveClass('is-disabled');
                        create_sinon.respondWithError(requests);
                        expect(link).not.toHaveClass('is-disabled');
                    });
                }

                for (i = 0; i < draft_states.length; i++) {
                    test_link_disabled_during_ajax_call(draft_states[i]);
                }
            });
        });
    });
