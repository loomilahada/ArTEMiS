package de.tum.in.www1.artemis.web.websocket.repository;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import javax.annotation.Nullable;
import javax.naming.NoPermissionException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import de.tum.in.www1.artemis.domain.*;
import de.tum.in.www1.artemis.service.AuthorizationCheckService;
import de.tum.in.www1.artemis.service.ParticipationService;
import de.tum.in.www1.artemis.service.UserService;
import de.tum.in.www1.artemis.service.connectors.GitService;
import de.tum.in.www1.artemis.web.rest.ParticipationResource;

@Controller
@SuppressWarnings("unused")
public class RepositoryWebsocketService {

    private final Logger log = LoggerFactory.getLogger(ParticipationResource.class);

    private final ParticipationService participationService;

    private final AuthorizationCheckService authCheckService;

    private final Optional<GitService> gitService;

    private final UserService userService;

    private final SimpMessageSendingOperations messagingTemplate;

    public RepositoryWebsocketService(UserService userService, ParticipationService participationService, AuthorizationCheckService authCheckService,
            Optional<GitService> gitService, SimpMessageSendingOperations messagingTemplate) {
        this.userService = userService;
        this.participationService = participationService;
        this.authCheckService = authCheckService;
        this.gitService = gitService;
        this.messagingTemplate = messagingTemplate;
    }

    @Nullable
    private boolean checkParticipation(Participation participation, Principal principal) {
        if (!userHasPermissions(participation, principal))
            return false;
        return Optional.ofNullable(participation).isPresent();
    }

    private boolean userHasPermissions(Participation participation, Principal principal) {
        if (!authCheckService.isOwnerOfParticipation(participation, principal)) {
            // if the user is not the owner of the participation, the user can only see it in case he is
            // a teaching assistant or an instructor of the course, or in case he is admin
            User user = userService.getUserWithGroupsAndAuthorities(principal);
            Course course = participation.getExercise().getCourse();
            return authCheckService.isTeachingAssistantInCourse(course, user) || authCheckService.isInstructorInCourse(course, user) || authCheckService.isAdmin();
        }
        return true;
    }

    /**
     * Retrieve the file from repository and update its content with the submission's content. Throws exceptions if the user doesn't have permissions, the file can't be retrieved
     * or it can't be updated.
     * 
     * @param participationId id of participation to which the file belongs
     * @param submission      information about file update
     * @param principal       used to check if the user can update the file
     * @throws InterruptedException
     * @throws IOException
     * @throws NoPermissionException
     */
    private void fetchAndUpdateFile(FileSubmission submission, Repository repository) throws IOException {
        Optional<File> file = gitService.get().getFileByName(repository, submission.getFileName());

        if (!file.isPresent()) {
            FileSubmissionError error = new FileSubmissionError(submission.getFileName(), "File could not be found.");
        }

        InputStream inputStream = new ByteArrayInputStream(submission.getFileContent().getBytes(StandardCharsets.UTF_8));
        Files.copy(inputStream, file.get().toPath(), StandardCopyOption.REPLACE_EXISTING);
    }

    /**
     * Update a list of files based on the submission's content.
     * 
     * @param participationId id of participation to which the files belong
     * @param submissions     information about the file updates
     * @param principal       used to check if the user can update the files
     */
    @MessageMapping("/topic/repository/{participationId}/files")
    public void updateFiles(@DestinationVariable Long participationId, @Payload List<FileSubmission> submissions, Principal principal) {
        Participation participation = participationService.findOne(participationId);
        // User must have the necessary permissions to update a file
        if (!checkParticipation(participation, principal)) {
            FileSubmissionError error = new FileSubmissionError(participationId, "noPermissions");
            messagingTemplate.convertAndSendToUser(principal.getName(), "/topic/repository/" + participationId + "/files", error);
            return;
        }
        // Git repository must be available to update a file
        Repository repository;
        try {
            repository = gitService.get().getOrCheckoutRepository(participation);
        }
        catch (IOException | InterruptedException ex) {
            FileSubmissionError error = new FileSubmissionError(participationId, "checkoutFailed");
            messagingTemplate.convertAndSendToUser(principal.getName(), "/topic/repository/" + participationId + "/files", error);
            return;
        }
        // If updating the file fails due to an IOException, we send an error message for the specific file and try to update the rest
        HashMap<String, String> fileSaveResult = new HashMap<>();
        submissions.forEach((submission) -> {
            try {
                fetchAndUpdateFile(submission, repository);
                fileSaveResult.put(submission.getFileName(), null);
            }
            catch (IOException ex) {
                fileSaveResult.put(submission.getFileName(), ex.getMessage());
            }
        });
        messagingTemplate.convertAndSendToUser(principal.getName(), "/topic/repository/" + participationId + "/files", fileSaveResult);
    }
}
