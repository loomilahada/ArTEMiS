import { NgModule } from '@angular/core';
import { AssessmentInstructionsComponent } from './assessment-instructions.component';
import { ExpandableParagraphComponent } from './expandable-paragraph/expandable-paragraph.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ExpandableSampleSolutionComponent } from './expandable-sample-solution/expandable-sample-solution.component';
import { ArTEMiSModelingEditorModule } from 'app/modeling-editor';
import { ArTEMiSSharedModule } from 'app/shared';

@NgModule({
    declarations: [AssessmentInstructionsComponent, ExpandableParagraphComponent, ExpandableSampleSolutionComponent],
    exports: [AssessmentInstructionsComponent],
    imports: [NgbModule, FontAwesomeModule, ArTEMiSSharedModule, ArTEMiSModelingEditorModule],
})
export class AssessmentInstructionsModule {}
