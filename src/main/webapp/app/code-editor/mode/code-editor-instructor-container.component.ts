import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, Subject } from 'rxjs';
import { Subscription } from 'rxjs/Subscription';
import { catchError, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { ProgrammingExercise, ProgrammingExerciseService } from 'app/entities/programming-exercise';
import { CourseExerciseService } from 'app/entities/course';
import { ParticipationService, Participation } from 'app/entities/participation';
import { CodeEditorContainer } from './code-editor-mode-container.component';
import { TranslateService } from '@ngx-translate/core';
import { DomainService, DomainType, CodeEditorRepositoryFileService } from '../code-editor-repository.service';
import { JhiAlertService } from 'ng-jhipster';
import { CodeEditorAceComponent } from 'app/code-editor/ace/code-editor-ace.component';
import { RepositoryFileService } from 'app/entities/repository';

enum REPOSITORY {
    ASSIGNMENT = 'ASSIGNMENT',
    TEMPLATE = 'TEMPLATE',
    SOLUTION = 'SOLUTION',
    TEST = 'TEST',
}

enum LOADING_STATE {
    NOT_LOADING = 'NOT_LOADING',
    INITIALIZING = 'INITIALIZING',
    CREATING_ASSIGNMENT_REPO = 'CREATING_ASSIGNMENT_REPO',
    DELETING_ASSIGNMENT_REPO = 'DELETING_ASSIGNMENT_REPO',
}

@Component({
    selector: 'jhi-code-editor-instructor',
    templateUrl: './code-editor-instructor-container.component.html',
})
export class CodeEditorInstructorContainerComponent extends CodeEditorContainer implements OnInit, OnDestroy {
    @ViewChild(CodeEditorAceComponent) aceEditor: CodeEditorAceComponent;
    REPOSITORY = REPOSITORY;
    LOADING_STATE = LOADING_STATE;

    exercise: ProgrammingExercise;
    selectedParticipation: Participation;
    selectedRepository: REPOSITORY;
    paramSub: Subscription;

    loadingState = LOADING_STATE.NOT_LOADING;
    domainChangeSubscription: Subscription;

    domainHasChanged = new Subject<void>();

    constructor(
        private exerciseService: ProgrammingExerciseService,
        private courseExerciseService: CourseExerciseService,
        private domainService: DomainService,
        participationService: ParticipationService,
        translateService: TranslateService,
        route: ActivatedRoute,
        jhiAlertService: JhiAlertService,
        repositoryFileService: CodeEditorRepositoryFileService,
    ) {
        super(participationService, translateService, route, jhiAlertService, repositoryFileService);
    }

    /**
     * On init load the exercise and the selected participation.
     * Checks what kind of participation is selected (template, solution, assignment) to show this information in the ui.
     */
    ngOnInit(): void {
        this.paramSub = this.route.params.subscribe(params => {
            const exerciseId = Number(params['exerciseId']);
            if (!this.exercise || this.exercise.id !== exerciseId) {
                this.loadingState = LOADING_STATE.INITIALIZING;
                // TODO: Fetch exercise test repo
                this.loadExercise(exerciseId)
                    .pipe(
                        catchError(() => throwError('exerciseNotFound')),
                        tap((exercise: ProgrammingExercise) => {
                            exercise.participations = exercise.participations.map(p => ({ ...p, exercise }));
                            exercise.templateParticipation = { ...exercise.templateParticipation, exercise };
                            exercise.solutionParticipation = { ...exercise.solutionParticipation, exercise };
                            this.exercise = exercise;

                            this.domainChangeSubscription = this.domainService
                                .subscribeDomainChange()
                                .pipe(
                                    filter(participation => !!participation),
                                    distinctUntilChanged(
                                        ([domainType1, domainValue1], [domainType2, domainValue2]) => domainType1 !== domainType2 || domainValue1.id !== domainValue2.id,
                                    ),
                                    tap(([, participation]) => {
                                        this.setSelectedParticipation(participation.id);
                                    }),
                                )
                                .subscribe();
                        }),
                        // Set selected participation
                        tap(() => {
                            this.domainService.setDomain([DomainType.PARTICIPATION, this.exercise.templateParticipation]);
                        }),
                    )
                    .subscribe(
                        () => {
                            this.loadingState = LOADING_STATE.NOT_LOADING;
                        },
                        err => this.onError(err),
                    );
            } else {
                this.domainService.setDomain([DomainType.PARTICIPATION, this.exercise.templateParticipation]);
            }
        });
    }

    ngOnDestroy() {
        if (this.domainChangeSubscription) {
            this.domainChangeSubscription.unsubscribe();
        }
    }

    /**
     * Set the selected participation based on a its id. If the id is null, set the template participation as default.
     **/
    setSelectedParticipation(participationId: number) {
        if (!participationId || participationId === this.exercise.templateParticipation.id) {
            this.selectedRepository = REPOSITORY.TEMPLATE;
            this.selectedParticipation = this.exercise.templateParticipation;
        } else if (participationId === this.exercise.solutionParticipation.id) {
            this.selectedRepository = REPOSITORY.SOLUTION;
            this.selectedParticipation = this.exercise.solutionParticipation;
        } else if (this.exercise.participations.length && participationId === this.exercise.participations[0].id) {
            this.selectedRepository = REPOSITORY.ASSIGNMENT;
            this.selectedParticipation = this.exercise.participations[0];
        }
    }

    /**
     * Try to recover the exercise from exercise storage, otherwise load the exercise from server.
     * @param exerciseId
     */
    loadExercise(exerciseId: number): Observable<ProgrammingExercise> {
        return !this.exercise
            ? this.exerciseService.findWithParticipations(exerciseId).pipe(
                  catchError(() => Observable.of(null)),
                  map(({ body }) => body),
              )
            : Observable.of(this.exercise);
    }

    selectSolutionParticipation() {
        this.selectedRepository = REPOSITORY.SOLUTION;
        this.selectedParticipation = this.exercise.solutionParticipation;
    }

    selectTemplateParticipation() {
        this.selectedRepository = REPOSITORY.TEMPLATE;
        this.selectedParticipation = this.exercise.templateParticipation;
    }

    selectAssignmentParticipation() {
        this.selectedRepository = REPOSITORY.ASSIGNMENT;
        this.selectedParticipation = this.exercise.participations[0];
    }

    selectTestRepository() {
        this.selectedRepository = REPOSITORY.TEST;
        this.selectedParticipation = null;
        this.domainService.setDomain([DomainType.TEST_REPOSITORY, this.exercise]);
    }

    /**
     * Creates an assignment participation for this user for this exercise.
     */
    createAssignmentParticipation() {
        this.loadingState = LOADING_STATE.CREATING_ASSIGNMENT_REPO;
        return this.courseExerciseService
            .startExercise(this.exercise.course.id, this.exercise.id)
            .pipe(
                catchError(() => throwError('participationCouldNotBeCreated')),
                tap(participation => {
                    this.exercise.participations = [participation];
                    this.loadingState = LOADING_STATE.NOT_LOADING;
                }),
            )
            .subscribe(() => {}, err => this.onError(err));
    }

    /**
     * Resets the assignment participation for this user for this exercise.
     */
    resetAssignmentParticipation() {
        this.loadingState = LOADING_STATE.DELETING_ASSIGNMENT_REPO;
        if (this.selectedRepository === REPOSITORY.ASSIGNMENT) {
            this.selectTemplateParticipation();
        }
        const assignmentParticipationId = this.exercise.participations[0].id;
        this.exercise.participations = [];
        this.participationService
            .delete(assignmentParticipationId, { deleteBuildPlan: true, deleteRepository: true })
            .pipe(
                catchError(() => throwError('participationCouldNotBeDeleted')),
                tap(() => this.createAssignmentParticipation()),
            )
            .subscribe(() => {}, err => this.onError(err));
    }
}