import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { renderWithData } from '../test/render';
import { api, requests, server } from '../test/server';
import { AddJobForm } from './AddJobForm';

describe('AddJobForm', () => {
  it('shows what is missing instead of submitting', async () => {
    renderWithData(<AddJobForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Save job' }));

    expect(await screen.findByText('Job title is required')).toBeInTheDocument();
    expect(screen.getByText('Company is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/job title/i)).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);
  });

  it('saves a job and clears the form', async () => {
    renderWithData(<AddJobForm />);
    await userEvent.type(screen.getByLabelText(/job title/i), 'Frontend Engineer');
    await userEvent.type(screen.getByLabelText(/company/i), 'Acme');
    await userEvent.type(screen.getByLabelText('Skills'), 'react, typescript');
    await userEvent.selectOptions(screen.getByLabelText('Workplace'), 'Remote');
    await userEvent.click(screen.getByRole('button', { name: 'Save job' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved “Frontend Engineer at Acme”',
    );
    expect(requests[0]).toEqual({
      operation: 'CreateJob',
      variables: {
        input: {
          title: 'Frontend Engineer',
          companyName: 'Acme',
          applicationStatus: 'SAVED',
          skills: ['react', 'typescript'],
          workplace: 'REMOTE',
        },
      },
    });
    expect(screen.getByLabelText(/job title/i)).toHaveValue('');
  });

  it('shows the server error', async () => {
    server.use(
      api.mutation('CreateJob', () =>
        HttpResponse.json({
          errors: [{ message: 'salaryMinUsd cannot be greater than salaryMaxUsd' }],
        }),
      ),
    );
    renderWithData(<AddJobForm />);
    await userEvent.type(screen.getByLabelText(/job title/i), 'Dev');
    await userEvent.type(screen.getByLabelText(/company/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Save job' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save the job: salaryMinUsd');
    });
  });
});
