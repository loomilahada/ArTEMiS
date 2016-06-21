(function() {
    'use strict';
    angular
        .module('exerciseApplicationApp')
        .factory('Result', Result)
        .factory('ParticipationResult', ParticipationResult);

    Result.$inject = ['$resource', 'DateUtils'];

    function Result ($resource, DateUtils) {
        var resourceUrl =  'api/results/:id';

        return $resource(resourceUrl, {}, {
            'query': { method: 'GET', isArray: true},
            'get': {
                method: 'GET',
                transformResponse: function (data) {
                    if (data) {
                        data = angular.fromJson(data);
                        data.buildCompletionDate = DateUtils.convertDateTimeFromServer(data.buildCompletionDate);
                    }
                    return data;
                }
            },
            'update': { method:'PUT' }
        });
    }

    ParticipationResult.$inject = ['$resource'];

    function ParticipationResult ($resource) {
        var resourceUrl = 'api/courses/:courseId/exercises/:exerciseId/participations/:participationId/results/:resultId';

        return $resource(resourceUrl, {}, {
            'query': { method: 'GET', isArray: true },
            'get': {
                method: 'GET',
                transformResponse: function (data) {
                    if (data) {
                        data = angular.fromJson(data);
                    }
                    return data;
                }
            }
        });
    }
})();