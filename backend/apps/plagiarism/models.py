from django.conf import settings
from django.db import models


class PlagiarismReport(models.Model):
	"""Stores one plagiarism detection run for a single assignment."""

	class Status(models.TextChoices):
		PENDING = 'pending', 'Pending'
		RUNNING = 'running', 'Running'
		COMPLETE = 'complete', 'Complete'
		FAILED = 'failed', 'Failed'

	assignment = models.OneToOneField(
		'assignment_submissions.Assignment',
		on_delete=models.CASCADE,
		related_name='plagiarism_report',
	)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	triggered_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
	)
	triggered_at = models.DateTimeField(auto_now_add=True)
	completed_at = models.DateTimeField(null=True, blank=True)
	error_message = models.TextField(blank=True)
	moss_urls = models.JSONField(default=dict, blank=True)

	class Meta:
		db_table = 'plagiarism_reports'

	def __str__(self):
		return f'Plagiarism report for assignment {self.assignment_id}'


class SimilarityMatch(models.Model):
	"""Stores one pairwise similarity result from a MOSS report."""

	report = models.ForeignKey(
		PlagiarismReport,
		on_delete=models.CASCADE,
		related_name='matches',
	)
	submission_a = models.ForeignKey(
		'assignment_submissions.AssignmentSubmission',
		on_delete=models.CASCADE,
		related_name='similarity_matches_as_a',
	)
	submission_b = models.ForeignKey(
		'assignment_submissions.AssignmentSubmission',
		on_delete=models.CASCADE,
		related_name='similarity_matches_as_b',
	)
	language = models.CharField(max_length=50)
	similarity_a = models.IntegerField()
	similarity_b = models.IntegerField()
	lines_matched = models.IntegerField()
	moss_link = models.URLField()

	class Meta:
		db_table = 'similarity_matches'

	@property
	def max_similarity(self):
		return max(self.similarity_a, self.similarity_b)

	def __str__(self):
		return (
			f'Match {self.submission_a_id} vs {self.submission_b_id} '
			f'({self.language}: {self.max_similarity}%)'
		)
