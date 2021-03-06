import { Component, Input } from '@angular/core';
import { CommitState, EditorState } from 'app/code-editor';

@Component({
    selector: 'jhi-code-editor-status',
    templateUrl: './code-editor-status.component.html',
    providers: [],
})
export class CodeEditorStatusComponent {
    @Input()
    editorState: EditorState;
    @Input()
    commitState: CommitState;
}
